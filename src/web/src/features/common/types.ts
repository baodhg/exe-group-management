export type CoursePhase = "Setup" | "Published" | "Expired" | "Finalized";

export interface Course {
  id: string;
  semesterId: string;
  semesterCode: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  classCode: string;
  lecturerId: string | null;
  lecturerName: string | null;
  minGroupSize: number;
  maxGroupSize: number;
  roomFactor: number;
  phase: CoursePhase;
  publishAt: string | null;
  expireAt: string | null;
  finalizedAt: string | null;
  studentCount: number;
  roomCount: number;
}

export interface RoomSummary {
  id: string;
  courseId: string;
  name: string;
  topic: string | null;
  status: "Open" | "Locked" | "Finalized";
  capacity: number;
  memberCount: number;
  freeSeats: number;
  groupTypeId: string;
  groupTypeCode: string;
  leaderId: string | null;
  leaderName: string | null;
  groupNo: number | null;
  majors?: MajorCount[];
  missingMajorSeats?: number;
}

export interface RoomSkill {
  skillCode: string;
  level: number;
}

export interface RoomMember {
  studentId: string;
  studentCode: string;
  fullName: string;
  majorId: string;
  majorCode: string;
  joinedAt: string;
  joinedVia: string;
  isLeader: boolean;
  skills: RoomSkill[];
}

export interface MajorCount {
  majorId: string;
  majorCode: string;
  members: number;
  required: number;
}

export interface RoomDetail extends RoomSummary {
  groupTypeName: string;
  minGroupSize: number;
  minDistinctMajors: number;
  eligible: boolean;
  missingMajorSeats: number;
  majors: MajorCount[];
  members: RoomMember[];
}

export interface OfficialGroupMember {
  studentId: string;
  studentCode: string;
  fullName: string;
  majorCode: string;
  isLeader: boolean;
}

export interface OfficialGroup {
  groupNo: number;
  roomId: string;
  roomName: string;
  topic: string | null;
  topicMissing: boolean;
  groupTypeCode: string;
  groupTypeName: string;
  leaderId: string | null;
  leaderName: string | null;
  memberCount: number;
  capacity: number;
  eligible: boolean;
  members: OfficialGroupMember[];
}

export interface OfficialGroups {
  courseId: string;
  courseName: string;
  phase: string;
  groups: OfficialGroup[];
}

export interface MissingTopic {
  roomId: string;
  roomName: string;
  groupNo: number;
  leaderId: string | null;
  leaderName: string | null;
}

export interface MissingTopics {
  courseId: string;
  courseName: string;
  phase: string;
  groups: MissingTopic[];
}

export interface SuggestionReason {
  code: string;
  detail: string;
}

export interface SuggestedRoom {
  room: RoomSummary;
  score: number | null;
  reasons: SuggestionReason[];
}

export interface RoomSuggestions {
  ranked: boolean;
  rooms: SuggestedRoom[];
}

export interface JoinRequest {
  id: string;
  courseId: string;
  roomId: string;
  roomName: string;
  studentId: string;
  studentCode: string | null;
  studentName: string | null;
  majorCode: string | null;
  skills: RoomSkill[];
  message: string | null;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
  reasonCode: string | null;
  reasonText: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface SkillLevel {
  skillId: string;
  skillCode: string;
  skillName: string;
  level: number;
  updatedAt: string;
}

export interface StudentProfile {
  semesterId: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  majorId: string;
  majorCode: string;
  majorName: string;
  skillsLocked: boolean;
  skills: SkillLevel[];
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
}

export interface Semester extends CatalogItem {
  startDate: string;
  endDate: string;
}

export interface GroupTypeMajor {
  majorId: string;
  majorCode: string;
  majorName: string;
  minMembers: number;
}

export interface GroupType extends CatalogItem {
  minDistinctMajors: number;
  majors: GroupTypeMajor[];
}

export interface StudentRef {
  studentId: string;
  studentCode: string;
  fullName: string;
  majorCode: string;
}

export interface OverviewRoom {
  room: RoomSummary;
  missingMembers: number;
  missingMajorSeats: number;
  majors: MajorCount[];
}

export interface CourseOverview {
  courseId: string;
  phase: CoursePhase;
  expireAt: string | null;
  finalizedAt: string | null;
  minGroupSize: number;
  studentCount: number;
  placedCount: number;
  roomCount: number;
  emptyRoomCount: number;
  eligibleRoomCount: number;
  unplaced: StudentRef[];
  ineligibleRooms: OverviewRoom[];
}

export interface Placement {
  student: StudentRef;
  roomId: string;
  roomName: string;
  reasons: SuggestionReason[];
}

export interface PlacementSuggestions {
  ranked: boolean;
  placements: Placement[];
  unplaced: StudentRef[];
  rooms: RoomSummary[];
}

export interface RosterEntry {
  studentId: string;
  studentCode: string;
  fullName: string;
  email: string;
  majorId: string;
  majorCode: string;
  enrolledAt: string;
  roomId: string | null;
  roomName: string | null;
}

export interface User {
  id: string;
  email: string;
  userCode: string | null;
  fullName: string;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string | null;
}

export type TopicProposalStatus = "Pending" | "Approved" | "Rejected" | "NeedsRevision";

export interface TopicProposal {
  id: string;
  courseId: string;
  roomId: string;
  roomName: string;
  groupNo: number | null;
  round: number;
  proposedTopic: string;
  description: string | null;
  proposedBy: string;
  status: TopicProposalStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export type DeliverableStatus = "NotStarted" | "InProgress" | "Submitted" | "Approved" | "ChangesRequested";

export interface Milestone {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  sequence: number;
  dueAt: string | null;
  weight: number;
  groupCount: number;
  submittedCount: number;
  approvedCount: number;
  progressPercent: number;
  createdAt: string;
}

export interface Deliverable {
  id: string;
  milestoneId: string;
  courseId: string;
  roomId: string;
  roomName: string;
  groupNo: number | null;
  title: string;
  notes: string | null;
  status: DeliverableStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  score: number | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface ProjectGroupProgress {
  roomId: string;
  roomName: string;
  groupNo: number | null;
  topic: string | null;
  progressPercent: number;
  averageScore: number | null;
  milestones: Milestone[];
}

export interface ProjectBoard {
  courseId: string;
  courseName: string;
  phase: string;
  overallPercent: number;
  milestones: Milestone[];
  deliverables: Deliverable[];
  groups: ProjectGroupProgress[];
}
