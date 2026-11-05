using ExeGroup.Recommendation.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Recommendation.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddRecommendationServices(this IServiceCollection services)
    {
        services.AddRecommendationRepositories();
        return services;
    }
}
