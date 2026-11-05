# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG SERVICE_DIR
ARG PROJECT
WORKDIR /repo
COPY Directory.Build.props Directory.Packages.props ./
COPY src/BuildingBlocks/ src/BuildingBlocks/
COPY src/Contracts/ src/Contracts/
COPY ${SERVICE_DIR}/ ${SERVICE_DIR}/
RUN --mount=type=cache,id=exe-group-nuget,target=/root/.nuget/packages,sharing=locked \
    dotnet restore "${SERVICE_DIR}/${PROJECT}/${PROJECT}.csproj"
RUN --mount=type=cache,id=exe-group-nuget,target=/root/.nuget/packages,sharing=locked \
    dotnet publish "${SERVICE_DIR}/${PROJECT}/${PROJECT}.csproj" -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
ARG PROJECT
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_HTTP_PORTS=8080 \
    SERVICE_ASSEMBLY=${PROJECT}.dll
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["sh", "-c", "exec dotnet \"$SERVICE_ASSEMBLY\""]
