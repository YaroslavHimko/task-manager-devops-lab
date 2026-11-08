using System.Collections.Concurrent;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// A tiny in-memory database for learning. It resets whenever this process restarts.
var tasks = new ConcurrentDictionary<int, TaskItem>();
tasks[1] = new TaskItem(1, "Learn Linux commands", false);
tasks[2] = new TaskItem(2, "Build a Docker image", false);
tasks[3] = new TaskItem(3, "Deploy to Kubernetes", false);
var nextId = 3;

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/tasks", () =>
    Results.Ok(tasks.Values.OrderBy(task => task.Id).ToArray()));

app.MapPost("/api/tasks", (CreateTaskRequest input) =>
{
    if (string.IsNullOrWhiteSpace(input.Title))
        return Results.BadRequest(new { error = "Task title cannot be empty" });

    var id = Interlocked.Increment(ref nextId);
    var task = new TaskItem(id, input.Title.Trim(), false);
    tasks[id] = task;
    return Results.Created($"/api/tasks/{id}", task);
});

app.MapPatch("/api/tasks/{id:int}/toggle", (int id) =>
{
    if (!tasks.TryGetValue(id, out var existing))
        return Results.NotFound();

    var updated = existing with { Done = !existing.Done };
    tasks[id] = updated;
    return Results.Ok(updated);
});

app.MapDelete("/api/tasks/{id:int}", (int id) =>
    tasks.TryRemove(id, out _) ? Results.NoContent() : Results.NotFound());

app.Run();

record TaskItem(int Id, string Title, bool Done);
record CreateTaskRequest(string Title);
