using ExeGroup.Recommendation.Repositories;
using ExeGroup.Recommendation.Services.Suggestions;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Recommendation.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddRecommendationServices(this IServiceCollection services)
    {
        services.AddRecommendationRepositories();
        services.AddSingleton<IRecommendationService, RecommendationService>();
        return services;
    }
}
