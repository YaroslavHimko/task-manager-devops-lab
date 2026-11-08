# Hands-on deployment lab: .NET 10 + Angular 22 + Docker + Kubernetes + Linux

**Audience:** a .NET + React developer who knows Windows Server but has never used Linux containers.

**Your output:** a working Task Manager on `http://localhost:8080`, first in Docker Compose and then in a local Kubernetes cluster. The API is ASP.NET Core 10, the UI is Angular 22. All the source code is included here; the archive contains **no prebuilt Docker images or node_modules**. The first build downloads dependencies, so internet access is required.

> Scope: local training, not a hardened public production setup. Task data is stored in API memory and **disappears after restart or redeployment**. No authentication, HTTPS, secrets, real database, or external ingress is configured.

## 0. Concept map (compare it with Windows Server)

| Familiar | New counterpart / concept |
|---|---|
| IIS site serving an SPA | Nginx serving compiled Angular assets |
| Windows service / IIS app pool | Linux application process inside a container |
| Windows executable deployed to a server | Docker image built from source and used to start containers |
| Manually managing multiple servers | Kubernetes Deployment manages desired replicas of Pods |
| Load balancer / DNS for app servers | Kubernetes Service discovers and routes to matching Pods |
| Windows Event Viewer / IIS logs | `docker logs`, `kubectl logs`, `journalctl` |
| React component and hooks | Angular component, template, signals, dependency injection |

**Important:** Docker is not a VM. A Linux container shares the Linux host's kernel. On Windows 10/11, Docker Desktop can run a Linux backend via WSL 2. **Docker Desktop is not intended for Windows Server**: use a Windows 10/11 development workstation or a Linux VM for this lab.

## 1. Install the minimum prerequisites

Recommended first route: **Windows 11 or supported Windows 10 + WSL2 Ubuntu + Docker Desktop**. You do not need the .NET or Node SDK locally just to complete the Docker/Kubernetes parts; both builds run inside containers.

**In an Administrator PowerShell terminal** (NOT in Ubuntu):

```powershell
wsl --install -d Ubuntu
```

Reboot if prompted. Open Ubuntu from Start, create a Linux username and password, then run:

```bash
whoami
pwd
uname -a
mkdir -p ~/projects
cd ~/projects
```

Install **Docker Desktop for Windows** and choose its **WSL 2 backend**; enable integration for your Ubuntu distribution in Docker Desktop Settings > Resources > WSL Integration. Be sure Docker is running in **Linux containers mode**. From your **Ubuntu** terminal, confirm:

```bash
docker version
docker compose version
docker run --rm hello-world
```

If `docker` is missing in Ubuntu, inspect Docker Desktop's WSL integration and restart Ubuntu. If permissions fail, confirm Docker Desktop is running and integrated; do not blindly apply `sudo` to every Docker command.

Put this archive inside the Ubuntu filesystem (for speed). If you downloaded the ZIP to your Windows **Downloads** folder, from Ubuntu run (replace `YOUR_WINDOWS_USERNAME` with your Windows username):

```bash
cd ~/projects
cp /mnt/c/Users/YOUR_WINDOWS_USERNAME/Downloads/dotnet-angular-docker-kubernetes-lab.zip .
unzip dotnet-angular-docker-kubernetes-lab.zip
cd dotnet-angular-docker-kubernetes-lab
ls -la
```

If Ubuntu says `unzip: command not found`, install it with `sudo apt update && sudo apt install -y unzip`. You can also unpack the archive in Windows File Explorer and copy its folder into Ubuntu. Use VS Code's **WSL** extension to edit files directly in the Ubuntu folder. Make sure commands are run from the folder containing `compose.yaml`.

### Essential Linux commands: run these before Docker

```bash
pwd                    # current directory
ls -la                 # list files including hidden ones
cd frontend            # change directory
cd ..                  # go one level up
cat compose.yaml       # print a file
head -n 20 api/Program.cs
grep -n "MapGet" api/Program.cs
mkdir practice && touch practice/hello.txt
rm practice/hello.txt && rmdir practice
ps aux | head          # see running processes
ss -lnt                # inspect listening TCP ports (may require iproute2)
curl -i http://localhost:8080/api/health  # after app is running
```

A shortcut: `Ctrl+C` stops the command currently running in the terminal. Shell path separators are `/`, and file names are usually case-sensitive. Linux uses `sudo` to run authorized admin commands.

## 2. Read the code: follow one HTTP request

Files to inspect:

- `api/Program.cs`: minimal ASP.NET endpoints (`GET`, `POST`, `PATCH`, `DELETE`) and the health endpoint.
- `frontend/src/app/app.component.ts`: component state held in Angular **signals**, HTTP calls made using `HttpClient`.
- `frontend/src/app/app.component.html`: Angular `@for`, `@if`, click handlers, and form binding.
- `frontend/nginx.conf`: proxies requests with path `/api/` to host `api`, port `8080`.

React translation: `signal<TaskItem[]>([])` resembles a state value updated by `useState`; `@for` resembles rendering `items.map(...)`; `ngOnInit()` is conceptually similar to a mount-time `useEffect`. Angular has more built-in structure and dependency injection.

Network path:

```text
Browser -> localhost:8080 -> Nginx/Angular container
                  /api/tasks -> http://api:8080/api/tasks -> .NET container
```

The browser does NOT need to know Docker's `api` hostname. Nginx runs within the container network, resolves it, and forwards requests. Using `/api` from the browser avoids cross-origin problems in this example.

## 3. FIRST DEPLOYMENT: Docker Compose

**Run these commands from the root directory containing `compose.yaml`, in Ubuntu.**

```bash
docker compose up --build -d
```

This builds two images (compiling .NET and Angular inside Linux), creates a project network, starts the API container, and starts the frontend container. The first build can be slower because Docker downloads SDK base images and npm packages.

Check status:

```bash
docker compose ps
docker compose logs --tail=50 api
docker compose logs --tail=50 frontend
curl -i http://localhost:8080/api/health
curl http://localhost:8080/api/tasks
```

Open **http://localhost:8080** in your browser, then add and complete a task. If the API health response succeeds but the UI doesn't load, check frontend logs.

### Make an API call directly from Linux

```bash
curl -i -X POST http://localhost:8080/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"My first deployed task"}'
```

Use `curl` to verify the backend without relying on the frontend.

### Change code and redeploy

Open `api/Program.cs`, replace the initial text `Learn Linux commands` with `I changed the .NET API`, save, then:

```bash
docker compose up --build -d
curl http://localhost:8080/api/tasks
```

Notice that creating a new Docker **image** does not mutate already-running containers: Compose recreates the container for the changed image. The demo's in-memory data will reset.

### Docker cheat sheet

```bash
docker images                      # images stored locally
docker ps                          # running containers
docker ps -a                       # all containers
docker compose ps                  # containers for this app
docker compose logs -f api         # follow live API output
docker compose exec api id         # show user inside the API container
docker compose exec frontend sh    # get a shell in Nginx container (exit to leave)
docker compose down                # stop/remove app containers and Compose network
```

`docker compose down` does not delete your source files or built images.

## 4. Understand Dockerfiles and Nginx

Read `api/Dockerfile` and `frontend/Dockerfile` line-by-line.

- `FROM` declares a base image. The first stage builds source; the second stage has only runtime files.
- `WORKDIR` sets the working directory inside the image.
- `COPY` copies source files from the build context into the image.
- `RUN` executes a command **while the image is built**.
- `ENTRYPOINT` specifies the executable **when the container starts**.
- `EXPOSE` documents a port; it does **not** publish the port to the host.
- Compose `ports: "8080:80"` publishes host port 8080 to frontend container port 80.

The Angular build turns TypeScript/template files into JavaScript/CSS/HTML in `dist/frontend/browser`. Nginx serves those static files. Its `/api/` rule forwards API calls to the backend. The ASP.NET container runs Kestrel on port 8080, not IIS.

## 5. SECOND DEPLOYMENT: Kubernetes using kind

**kind** means Kubernetes IN Docker. It's a local Kubernetes cluster, not cloud hosting. Install `kubectl` (Kubernetes CLI) and `kind` in your **Ubuntu environment**. For installation and current architecture-specific commands, use:

- kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/
- kind: https://kind.sigs.k8s.io/docs/user/quick-start/

Check:

```bash
kubectl version --client
kind version
```

Leave Docker Desktop running, then create a local cluster:

```bash
kind create cluster --name interview-lab --wait 120s
kubectl cluster-info --context kind-interview-lab
kubectl config current-context
```

`kind` creates a Kubernetes node inside a Docker container. Your two application images exist in the local Docker image store, so you must **load them into kind's node** before deploying. If you previously ran `docker compose down`, the images are still available.

```bash
docker compose build
kind load docker-image interview-api:v1 interview-frontend:v1 --name interview-lab
kubectl apply -f k8s/
kubectl rollout status deployment/api --timeout=180s
kubectl rollout status deployment/frontend --timeout=180s
kubectl get pods
kubectl get deployments
kubectl get services
```

In a terminal that stays open:

```bash
kubectl port-forward service/frontend 8080:80
```

Open **http://localhost:8080** again. If Docker Compose is still using port 8080, stop it first with `docker compose down`, then retry the port-forward. **Port-forward is a local access/debugging technique, not a production ingress.**

**Kubernetes files to study:**

- `k8s/01-api-deployment.yaml`: run one API Pod and check `/api/health`.
- `k8s/02-api-service.yaml`: stable DNS name `api` and TCP port 8080.
- `k8s/03-frontend-deployment.yaml`: run two frontend Pods.
- `k8s/04-frontend-service.yaml`: stable name `frontend` and TCP port 80.

How these map to real systems:

```text
Deployment -> manages replicas of Pods
Pod -> holds one or more application containers
Service -> stable name and virtual network endpoint for selected Pods
Readiness probe -> should this Pod receive traffic now?
Liveness probe -> should Kubernetes restart this container?
```

**Why can't I simply build a new image and expect Kubernetes to update?** Kubernetes deploys image *tags*, not your source folder. Use a new immutable version tag and update the Deployment. `:latest` can cause confusing caching behavior. We use `:v1` for the lab and `imagePullPolicy: IfNotPresent`, as kind recommends for locally loaded images.

### Kubernetes troubleshooting commands

Open a separate Ubuntu terminal for these while port-forward is active:

```bash
kubectl get pods -o wide
kubectl describe deployment/api
kubectl describe pod -l app=api
kubectl logs deployment/api --tail=100
kubectl logs deployment/frontend --tail=100
kubectl get endpointslice
kubectl exec deployment/api -- printenv ASPNETCORE_URLS
kubectl get events --sort-by=.metadata.creationTimestamp
```

Try scaling the frontend (safe for this stateless app):

```bash
kubectl scale deployment/frontend --replicas=3
kubectl get pods -l app=frontend -w
```

Exit the watch with `Ctrl+C`. Do **not** scale this example API to multiple replicas: each API Pod would have its own independent in-memory tasks, causing inconsistent results. In a real application, persist data to a database.

### Simulate failure and recovery

```bash
kubectl scale deployment/api --replicas=0
kubectl get pods
curl -i http://localhost:8080/api/health   # frontend Nginx should return 502
kubectl scale deployment/api --replicas=1
kubectl rollout status deployment/api
curl -i http://localhost:8080/api/health
```

Watch Kubernetes restore service, then examine logs. This teaches you more than memorizing definitions.

Clean up:

```bash
# Stop port-forward with Ctrl+C in its terminal first.
kubectl delete -f k8s/
kind delete cluster --name interview-lab
```

## 6. OPTIONAL: develop without rebuilding Docker images each time

For everyday development, developers often run local SDKs or a dev container, then create Docker images for deployment. To try local development, install **.NET 10 SDK** and **Node.js 24.15.0+** in Ubuntu. Angular 22 needs a supported Node 22/24/26 version; Node 24 at 24.15+ is suitable. Use the official installation instructions for your Ubuntu version:

- .NET: https://learn.microsoft.com/en-us/dotnet/core/install/linux-ubuntu
- Node: https://nodejs.org/en/download

Then in **terminal A**:

```bash
cd api
dotnet run --urls http://localhost:5080
```

In **terminal B** (in the same project root):

```bash
cd frontend
npm install
npm start
```

Open **http://localhost:4200**. The Angular dev server proxies `/api` to `http://localhost:5080` using `proxy.conf.json`, so you don't need browser CORS configuration. Both development processes must stay running.

## 7. Common errors and what they mean

| Symptom | Check |
|---|---|
| `docker: command not found` in Ubuntu | Docker Desktop WSL integration / restart Ubuntu |
| `Cannot connect to the Docker daemon` | Is Docker Desktop running in Linux mode? |
| `port is already allocated` | Another program/Compose is using host port 8080. Run `docker compose down` or use another host port. |
| Angular fails during npm install | Internet, Node image version, dependency compatibility, npm registry availability |
| Browser works, API says 502 | `docker compose logs api`; `kubectl logs deployment/api`; `kubectl get svc api` |
| Kubernetes Pod `ImagePullBackOff` | `kind load docker-image ... --name interview-lab` and image tag matching YAML |
| Kubernetes Pod `CrashLoopBackOff` | `kubectl logs`, `kubectl describe pod`, environment and health checks |
| `kubectl port-forward` closes | It is a foreground command; keep it open in a separate terminal |
| Changes don't appear | Rebuild image and recreate container; for K8s use a new image tag and rollout |
| Tasks disappear | Expected: backend stores tasks in RAM only |

## 8. Four interview-ready things to say

1. **What is an image vs container?** An image is an immutable packaged filesystem/configuration template; a container is a running instance of it.
2. **Docker vs Kubernetes?** Docker builds/runs containers; Kubernetes schedules and manages containerized workloads across nodes, including desired replicas, service discovery, and restart/rollout behavior.
3. **What is a Pod vs Deployment vs Service?** A Pod is the smallest deployable workload unit, a Deployment manages replicated Pods, and a Service provides a stable endpoint for a group of Pods.
4. **How would you troubleshoot a 502?** Check browser/network path, reverse-proxy logs, upstream API health and logs, container/pod state, service selectors, endpoints, and ports in order.

See `INTERVIEW_PREP.md` for more questions and `EXERCISES.md` for progressive practice tasks.

## Official references

- .NET support: https://dotnet.microsoft.com/platform/support/policy
- Angular versions: https://angular.dev/reference/versions
- Angular workspace config: https://angular.dev/reference/configs/workspace-config
- Docker Desktop + WSL 2: https://docs.docker.com/desktop/features/wsl/
- Docker Compose: https://docs.docker.com/reference/compose-file/services/
- kind quick start: https://kind.sigs.k8s.io/docs/user/quick-start/
- Kubernetes probes: https://kubernetes.io/docs/concepts/workloads/pods/probes/


## Visual, end-to-end pipeline walkthrough (new)

Open [`docs/deployment-pipeline-visual.html`](docs/deployment-pipeline-visual.html) locally in a browser. It illustrates:

- code → Docker builds → Compose → kind / Kubernetes → (optional) GitHub Actions → GHCR → a real cluster;
- browser → Nginx → Kubernetes Service → .NET API request flow;
- exact lab commands, diagnostics, exercises, rolling updates, and rollbacks.

Text companion: [`docs/PIPELINE-GUIDE.md`](docs/PIPELINE-GUIDE.md). Optional sample publish workflow: [`.github/workflows/container-publish.yml`](.github/workflows/container-publish.yml).
