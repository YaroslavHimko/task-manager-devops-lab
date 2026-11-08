# Stage 1: Build using the large SDK image.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY TodoApi.csproj ./
RUN dotnet restore
COPY . ./
RUN dotnet publish -c Release -o /publish --no-restore

# Stage 2: Run using the smaller ASP.NET runtime image.
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /publish ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "TodoApi.dll"]
