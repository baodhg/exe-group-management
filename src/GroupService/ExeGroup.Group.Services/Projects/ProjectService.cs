using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;

namespace ExeGroup.Group.Services.Projects;

public sealed record MilestoneModel(
    Guid Id,
    Guid CourseId,
    string Name,
    string? Description,
    int Sequence,
    DateTime? DueAt,
    int Weight,
    int GroupCount,
    int SubmittedCount,
    int ApprovedCount,
    DateTime CreatedAt)
{
    public int ProgressPercent => GroupCount <= 0 ? 0 : (int)Math.Round(100.0 * SubmittedCount / GroupCount);
}

public sealed record DeliverableModel(
    Guid Id,
    Guid MilestoneId,
    Guid CourseId,
    Guid RoomId,
    string RoomName,
    int? GroupNo,
    string Title,
    string? Notes,
    string Status,
    Guid? SubmittedBy,
    DateTime? SubmittedAt,
    Guid? ReviewedBy,
    DateTime? ReviewedAt,
    decimal? Score,
    string? ReviewNote,
    DateTime CreatedAt);

public sealed record ProjectBoardModel(
    Guid CourseId,
    string CourseName,
    string Phase,
    IReadOnlyList<MilestoneModel> Milestones,
    IReadOnlyList<DeliverableModel> Deliverables,
    IReadOnlyList<ProjectGroupProgressModel> Groups)
{
    public int OverallPercent => Groups.Count == 0 ? 0 : (int)Math.Round(Groups.Average(group => group.ProgressPercent));
}

public sealed record ProjectGroupProgressModel(
    Guid RoomId,
    string RoomName,
    int? GroupNo,
    string? Topic,
    int ProgressPercent,
    decimal? AverageScore,
    IReadOnlyList<MilestoneModel> Milestones);

public sealed record MilestoneChanges(string Name, string? Description, int Sequence, DateTime? DueAt, int Weight);

public interface IProjectService
{
    Task<ProjectBoardModel> GetBoardAsync(Guid courseId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MilestoneModel>> ListMilestonesAsync(Guid courseId, CancellationToken cancellationToken);

    Task<MilestoneModel> CreateMilestoneAsync(Guid courseId, MilestoneChanges changes, CancellationToken cancellationToken);

    Task<MilestoneModel> UpdateMilestoneAsync(Guid milestoneId, MilestoneChanges changes, CancellationToken cancellationToken);

    Task<DeliverableModel> StartDeliverableAsync(Guid milestoneId, Guid roomId, string title, string? notes, CancellationToken cancellationToken);

    Task<DeliverableModel> SubmitDeliverableAsync(Guid deliverableId, string? notes, CancellationToken cancellationToken);

    Task<DeliverableModel> ReviewDeliverableAsync(Guid deliverableId, string decision, string? note, decimal? score, CancellationToken cancellationToken);
}

public sealed class ProjectService(
    IProjectRepository projects,
    IRoomRepository rooms,
    IOutbox outbox,
    ITransactionRunner transactions,
    ICurrentUser currentUser,
    IClock clock) : IProjectService
{
    public const int MaxNameLength = 100;
    public const int MaxDescriptionLength = 500;
    public const int MaxTitleLength = 150;
    public const int MaxNotesLength = 1000;
    public const int MaxNoteLength = 500;
    public const int MaxWeight = 100;
    public const decimal MaxScore = 10m;

    private static readonly string[] ReviewDecisions =
        [DeliverableStatuses.Approved, DeliverableStatuses.ChangesRequested];

    public async Task<ProjectBoardModel> GetBoardAsync(Guid courseId, CancellationToken cancellationToken)
    {
        var course = await rooms.FindCourseAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);
        await EnsureCanReadAsync(course, cancellationToken);
        return await BuildBoardAsync(course, cancellationToken);
    }

    public async Task<IReadOnlyList<MilestoneModel>> ListMilestonesAsync(Guid courseId, CancellationToken cancellationToken)
    {
        var course = await rooms.FindCourseAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);
        await EnsureCanReadAsync(course, cancellationToken);
        var milestones = await projects.ListMilestonesAsync(courseId, cancellationToken);
        var deliverables = await projects.ListDeliverablesAsync(courseId, cancellationToken);
        return milestones.Select(milestone => ToMilestone(milestone, deliverables)).ToList();
    }

    public async Task<MilestoneModel> CreateMilestoneAsync(Guid courseId, MilestoneChanges changes, CancellationToken cancellationToken)
    {
        var name = Required(changes.Name, "name", MaxNameLength);
        var description = Optional(changes.Description, "description", MaxDescriptionLength);
        var weight = changes.Weight <= 0 ? 1 : Math.Min(changes.Weight, MaxWeight);
        var milestoneId = Guid.NewGuid();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var course = await rooms.FindCourseAsync(courseId, token) ?? throw new NotFoundException("Course", courseId);
                EnsureCourseFinalized(course);
                EnsureMilestoneManager(course);
                if (await projects.FindMilestoneByNameAsync(courseId, name, token) is not null)
                {
                    throw new ConflictException(GroupErrorCodes.MilestoneNameTaken, $"The course already has a milestone named '{name}'.");
                }

                var sequence = changes.Sequence > 0 ? changes.Sequence : await projects.NextSequenceAsync(courseId, token);
                var existing = await projects.ListMilestonesAsync(courseId, token);
                if (existing.Any(item => item.Sequence == sequence))
                {
                    throw new ConflictException(GroupErrorCodes.MilestoneSequenceTaken, $"A milestone with the sequence {sequence} already exists.");
                }

                projects.AddMilestone(new ProjectMilestone
                {
                    MilestoneId = milestoneId,
                    CourseId = courseId,
                    Name = name,
                    Description = description,
                    Sequence = sequence,
                    DueAt = changes.DueAt,
                    Weight = weight,
                    CreatedAt = clock.UtcNow,
                });
                var groups = await rooms.ListRowsAsync(courseId, token);
                var leaderIds = groups
                    .Where(row => row.Room.GroupNo is not null && row.Room.LeaderId is not null)
                    .Select(row => row.Room.LeaderId!.Value)
                    .Distinct()
                    .ToList();
                foreach (var group in groups.Where(row => row.Room.GroupNo is not null))
                {
                    projects.AddDeliverable(new ProjectDeliverable
                    {
                        DeliverableId = Guid.NewGuid(),
                        MilestoneId = milestoneId,
                        CourseId = courseId,
                        RoomId = group.Room.RoomId,
                        Title = name,
                        Status = DeliverableStatuses.NotStarted,
                        CreatedAt = clock.UtcNow,
                    });
                }

                outbox.Enqueue(
                    GroupEventTypes.MilestoneCreated,
                    milestoneId,
                    new MilestoneCreatedEvent(milestoneId, courseId, name, sequence, changes.DueAt, weight, leaderIds, course.LecturerId, currentUser.RequireUserId()));
                await projects.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        var milestones = await ListMilestonesAsync(courseId, cancellationToken);
        return milestones.Single(milestone => milestone.Id == milestoneId);
    }

    public async Task<MilestoneModel> UpdateMilestoneAsync(Guid milestoneId, MilestoneChanges changes, CancellationToken cancellationToken)
    {
        var name = Required(changes.Name, "name", MaxNameLength);
        var description = Optional(changes.Description, "description", MaxDescriptionLength);
        var weight = changes.Weight <= 0 ? 1 : Math.Min(changes.Weight, MaxWeight);
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var milestone = await projects.FindMilestoneAsync(milestoneId, token) ?? throw new NotFoundException("ProjectMilestone", milestoneId);
                var course = await rooms.FindCourseAsync(milestone.CourseId, token) ?? throw new NotFoundException("Course", milestone.CourseId);
                EnsureCourseFinalized(course);
                EnsureMilestoneManager(course);
                var duplicate = await projects.FindMilestoneByNameAsync(milestone.CourseId, name, token);
                if (duplicate is not null && duplicate.MilestoneId != milestoneId)
                {
                    throw new ConflictException(GroupErrorCodes.MilestoneNameTaken, $"The course already has a milestone named '{name}'.");
                }

                milestone.Name = name;
                milestone.Description = description;
                milestone.Sequence = changes.Sequence > 0 ? changes.Sequence : milestone.Sequence;
                milestone.DueAt = changes.DueAt;
                milestone.Weight = weight;
                await projects.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        var milestones = await ListMilestonesAsync((await projects.FindMilestoneAsync(milestoneId, cancellationToken))!.CourseId, cancellationToken);
        return milestones.Single(milestone => milestone.Id == milestoneId);
    }

    public async Task<DeliverableModel> StartDeliverableAsync(Guid milestoneId, Guid roomId, string title, string? notes, CancellationToken cancellationToken)
    {
        var text = Required(title, "title", MaxTitleLength);
        var note = Optional(notes, "notes", MaxNotesLength);
        var userId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var milestone = await projects.FindMilestoneAsync(milestoneId, token) ?? throw new NotFoundException("ProjectMilestone", milestoneId);
                var course = await rooms.FindCourseAsync(milestone.CourseId, token) ?? throw new NotFoundException("Course", milestone.CourseId);
                EnsureCourseFinalized(course);
                await EnsureMemberAsync(roomId, milestone.CourseId, userId, token);
                var deliverable = await projects.FindDeliverableAsync(milestoneId, roomId, token);
                if (deliverable is null)
                {
                    deliverable = new ProjectDeliverable
                    {
                        DeliverableId = Guid.NewGuid(),
                        MilestoneId = milestoneId,
                        CourseId = milestone.CourseId,
                        RoomId = roomId,
                        Title = text,
                        Status = DeliverableStatuses.InProgress,
                        CreatedAt = clock.UtcNow,
                    };
                    projects.AddDeliverable(deliverable);
                }
                else
                {
                    deliverable.Title = text;
                    deliverable.Notes = note;
                    if (deliverable.Status == DeliverableStatuses.NotStarted)
                    {
                        deliverable.Status = DeliverableStatuses.InProgress;
                    }
                }

                await projects.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        var deliverable = await projects.FindDeliverableAsync(milestoneId, roomId, cancellationToken);
        return ToDeliverable(deliverable!, await rooms.FindRowAsync(roomId, cancellationToken));
    }

    public async Task<DeliverableModel> SubmitDeliverableAsync(Guid deliverableId, string? notes, CancellationToken cancellationToken)
    {
        var note = Optional(notes, "notes", MaxNotesLength);
        var userId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var deliverable = await projects.FindDeliverableAsync(deliverableId, token) ?? throw new NotFoundException("ProjectDeliverable", deliverableId);
                var milestone = await projects.FindMilestoneAsync(deliverable.MilestoneId, token) ?? throw new NotFoundException("ProjectMilestone", deliverable.MilestoneId);
                var course = await rooms.FindCourseAsync(deliverable.CourseId, token) ?? throw new NotFoundException("Course", deliverable.CourseId);
                EnsureCourseFinalized(course);
                await EnsureMemberAsync(deliverable.RoomId, deliverable.CourseId, userId, token);
                if (deliverable.Status == DeliverableStatuses.Approved)
                {
                    throw new ConflictException(GroupErrorCodes.DeliverableNotSubmitted, "This deliverable was already approved.");
                }

                deliverable.Notes = note ?? deliverable.Notes;
                deliverable.Status = DeliverableStatuses.Submitted;
                deliverable.SubmittedBy = userId;
                deliverable.SubmittedAt = clock.UtcNow;
                deliverable.Score = null;
                deliverable.ReviewedBy = null;
                deliverable.ReviewedAt = null;
                deliverable.ReviewNote = null;
                var room = await rooms.FindAsync(deliverable.RoomId, token);
                var group = await rooms.FindRowAsync(deliverable.RoomId, token);
                outbox.Enqueue(
                    GroupEventTypes.DeliverableSubmitted,
                    deliverable.DeliverableId,
                    new DeliverableSubmittedEvent(deliverable.DeliverableId, milestone.MilestoneId, deliverable.CourseId, deliverable.RoomId, room?.Name ?? string.Empty, deliverable.Title, userId, group?.Room.LeaderId, course.LecturerId));
                await projects.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        var deliverable = await projects.FindDeliverableAsync(deliverableId, cancellationToken);
        return ToDeliverable(deliverable!, await rooms.FindRowAsync(deliverable!.RoomId, cancellationToken));
    }

    public async Task<DeliverableModel> ReviewDeliverableAsync(Guid deliverableId, string decision, string? note, decimal? score, CancellationToken cancellationToken)
    {
        var verdict = ReviewDecisions.FirstOrDefault(known => string.Equals(known, decision?.Trim(), StringComparison.OrdinalIgnoreCase))
            ?? throw new ValidationFailedException("decision", $"Decision must be one of {string.Join(", ", ReviewDecisions)}.");
        var text = Optional(note, "note", MaxNoteLength);
        if (score is { } value && (value < 0 || value > MaxScore))
        {
            throw new ValidationFailedException("score", $"The score must be between 0 and {MaxScore}.");
        }

        var reviewerId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var deliverable = await projects.FindDeliverableAsync(deliverableId, token) ?? throw new NotFoundException("ProjectDeliverable", deliverableId);
                var course = await rooms.FindCourseAsync(deliverable.CourseId, token) ?? throw new NotFoundException("Course", deliverable.CourseId);
                EnsureCourseFinalized(course);
                await EnsureReviewerAsync(course, reviewerId);
                if (deliverable.Status != DeliverableStatuses.Submitted)
                {
                    throw new ConflictException(GroupErrorCodes.DeliverableNotSubmitted, $"This deliverable is {deliverable.Status}, not Submitted.");
                }

                deliverable.Status = verdict;
                deliverable.ReviewedBy = reviewerId;
                deliverable.ReviewedAt = clock.UtcNow;
                deliverable.ReviewNote = text;
                deliverable.Score = verdict == DeliverableStatuses.Approved ? score : null;
                var room = await rooms.FindAsync(deliverable.RoomId, token);
                var group = await rooms.FindRowAsync(deliverable.RoomId, token);
                outbox.Enqueue(
                    GroupEventTypes.DeliverableReviewed,
                    deliverable.DeliverableId,
                    new DeliverableReviewedEvent(deliverable.DeliverableId, deliverable.MilestoneId, deliverable.CourseId, deliverable.RoomId, room?.Name ?? string.Empty, deliverable.Title, verdict, score, text, reviewerId, group?.Room.LeaderId, course.LecturerId));
                await projects.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        var deliverable = await projects.FindDeliverableAsync(deliverableId, cancellationToken);
        return ToDeliverable(deliverable!, await rooms.FindRowAsync(deliverable!.RoomId, cancellationToken));
    }

    private async Task<ProjectBoardModel> BuildBoardAsync(Course course, CancellationToken cancellationToken)
    {
        var milestones = await projects.ListMilestonesAsync(course.CourseId, cancellationToken);
        var rows = await projects.ListDeliverableRowsAsync(course.CourseId, cancellationToken);
        var roomRows = await rooms.ListRowsAsync(course.CourseId, cancellationToken);
        var milestoneModels = milestones.Select(milestone => ToMilestone(milestone, rows.Select(row => row.Deliverable).ToList())).ToList();
        var deliverableModels = rows
            .Select(row => ToDeliverable(row.Deliverable, roomRows.FirstOrDefault(candidate => candidate.Room.RoomId == row.Deliverable.RoomId)))
            .ToList();

        var groups = roomRows
            .Where(row => row.Room.GroupNo is not null)
            .OrderBy(row => row.Room.GroupNo)
            .Select(row =>
            {
                var own = rows.Where(candidate => candidate.Deliverable.RoomId == row.Room.RoomId).Select(candidate => candidate.Deliverable).ToList();
                var ownMilestones = milestones
                    .Select(milestone => ToMilestone(milestone, own))
                    .ToList();
                var scored = own.Where(deliverable => deliverable.Score is not null).Select(deliverable => deliverable.Score!.Value).ToList();
                var done = own.Count(deliverable => deliverable.Status == DeliverableStatuses.Submitted || deliverable.Status == DeliverableStatuses.Approved);
                var percent = own.Count == 0 ? 0 : (int)Math.Round(100.0 * done / own.Count);
                return new ProjectGroupProgressModel(
                    row.Room.RoomId,
                    row.Room.Name,
                    row.Room.GroupNo,
                    row.Room.Topic,
                    percent,
                    scored.Count == 0 ? null : Math.Round(scored.Average(), 2),
                    ownMilestones);
            })
            .ToList();

        return new ProjectBoardModel(course.CourseId, course.ClassCode, course.Phase, milestoneModels, deliverableModels, groups);
    }

    private async Task EnsureCanReadAsync(Course course, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequireUserId();
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        if (currentUser.IsInRole(Roles.Lecturer) && course.LecturerId == userId)
        {
            return;
        }

        var ledRooms = await rooms.ListLedRoomsAsync(userId, cancellationToken);
        if (ledRooms.Count > 0)
        {
            return;
        }

        var membership = await rooms.FindActiveMembershipAsync(course.CourseId, userId, cancellationToken);
        if (membership is not null)
        {
            return;
        }

        throw new ForbiddenException("Only the members of the course, the lecturer and administrators can see the project board.");
    }

    private async Task EnsureMemberAsync(Guid roomId, Guid courseId, Guid userId, CancellationToken cancellationToken)
    {
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        var membership = await rooms.FindActiveMembershipAsync(courseId, userId, cancellationToken);
        if (membership is null || membership.RoomId != roomId)
        {
            throw new ForbiddenException("Only the members of the official group can work on its deliverable.");
        }
    }

    private async Task EnsureReviewerAsync(Course course, Guid reviewerId)
    {
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        if (currentUser.IsInRole(Roles.Lecturer) && course.LecturerId == reviewerId)
        {
            return;
        }

        throw new ForbiddenException("Only the lecturer of the course and administrators can review a deliverable.");
    }

    private void EnsureMilestoneManager(Course course)
    {
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        if (currentUser.IsInRole(Roles.Lecturer) && course.LecturerId == currentUser.RequireUserId())
        {
            return;
        }

        throw new ForbiddenException("Only the lecturer of the course and administrators can manage the milestones of a course.");
    }

    private static void EnsureCourseFinalized(Course course)
    {
        if (course.Phase != CoursePhases.Finalized)
        {
            throw new ConflictException(GroupErrorCodes.CourseNotFinalized, "The project lifecycle starts when the course is finalized.");
        }
    }

    private static MilestoneModel ToMilestone(ProjectMilestone milestone, IReadOnlyList<ProjectDeliverable> deliverables)
    {
        var own = deliverables.Where(deliverable => deliverable.MilestoneId == milestone.MilestoneId).ToList();
        return new MilestoneModel(
            milestone.MilestoneId,
            milestone.CourseId,
            milestone.Name,
            milestone.Description,
            milestone.Sequence,
            milestone.DueAt,
            milestone.Weight,
            own.Count,
            own.Count(deliverable => deliverable.Status == DeliverableStatuses.Submitted || deliverable.Status == DeliverableStatuses.Approved),
            own.Count(deliverable => deliverable.Status == DeliverableStatuses.Approved),
            milestone.CreatedAt);
    }

    private static DeliverableModel ToDeliverable(ProjectDeliverable deliverable, RoomRow? room) =>
        new(
            deliverable.DeliverableId,
            deliverable.MilestoneId,
            deliverable.CourseId,
            deliverable.RoomId,
            room?.Room.Name ?? string.Empty,
            room?.Room.GroupNo,
            deliverable.Title,
            deliverable.Notes,
            deliverable.Status,
            deliverable.SubmittedBy,
            deliverable.SubmittedAt,
            deliverable.ReviewedBy,
            deliverable.ReviewedAt,
            deliverable.Score,
            deliverable.ReviewNote,
            deliverable.CreatedAt);

    private static string Required(string? value, string field, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            throw new ValidationFailedException(field, "This field is required.");
        }

        return text.Length <= maxLength
            ? text
            : throw new ValidationFailedException(field, $"Use at most {maxLength} characters.");
    }

    private static string? Optional(string? value, string field, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        return text.Length <= maxLength
            ? text
            : throw new ValidationFailedException(field, $"Use at most {maxLength} characters.");
    }
}
