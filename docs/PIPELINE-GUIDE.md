# Illustrated deployment pipeline — quick command companion

See **`deployment-pipeline-visual.html`** in this same folder for diagrams, explanations, clickable chapters, troubleshooting, and interview prompts. Open it directly in a browser (no web server required).

## Architecture

```text
SOURCE (C# / Angular)
    -> build (dotnet publish / ng build)
    -> two Docker images (API, Nginx+Angular)
    -> [LOCAL] docker compose up / kind load docker-image
    -> [TEAM CI/CD] push to registry (GHCR), update Kubernetes image tags
    -> K8s Deployment -> Pods <- Service
    -> Browser -> frontend Service -> Nginx -> api Service -> .NET Kestrel
```

## Setup (PowerShell, Windows 10/11 workstation)

```powershell
wsl --install -d Ubuntu
```

Install Docker Desktop with WSL integration. Docker Desktop isn't supported on Windows Server; use a workstation or Linux VM. In Ubuntu, unzip the lab archive into `~/projects` and `cd` to the folder containing `compose.yaml`.

## Local Docker Compose (Ubuntu shell)

```bash
docker version
docker compose version
docker compose up --build -d
docker compose ps
curl -i http://localhost:8080/api/health
docker compose logs --tail=50 api
docker compose down
```

Open `http://localhost:8080`. The frontend handles incoming traffic. Nginx proxies `/api/` to `http://api:8080`, where `api` is the internal Compose DNS name.

## Local Kubernetes with kind (Ubuntu shell)

First install `kind` and `kubectl` from their official documentation. Run these commands in the project root:

```bash
docker compose build
kind create cluster --name interview-lab --wait 120s
kind load docker-image interview-api:v1 interview-frontend:v1 --name interview-lab
kubectl apply -f k8s/
kubectl rollout status deployment/api --timeout=180s
kubectl rollout status deployment/frontend --timeout=180s
kubectl get deployments,pods,services
kubectl port-forward service/frontend 8080:80
```

Keep port-forward running in its own terminal and open `http://localhost:8080`. Stop Compose first if it still occupies 8080.

## Make a new release

```bash
# After changing api/Program.cs:
docker build -t interview-api:v2 ./api
kind load docker-image interview-api:v2 --name interview-lab
kubectl set image deployment/api api=interview-api:v2
kubectl rollout status deployment/api
kubectl rollout history deployment/api
kubectl rollout undo deployment/api
```

The API holds tasks in RAM, so redeploying it resets its tasks. Keep the API at one replica in this demonstration; a real team would use external persistent storage.

## Troubleshoot

```bash
docker compose logs --tail=80 frontend
docker compose logs --tail=80 api
kubectl get pods -o wide
kubectl describe deployment/api
kubectl logs deployment/api --tail=100
kubectl get svc api
kubectl get endpointslice -l kubernetes.io/service-name=api
kubectl exec deployment/frontend -- wget -qO- http://api:8080/api/health
```

Common cases: 502 means Nginx can't reach the backend; `ImagePullBackOff` often means the tag wasn't loaded into kind; `CrashLoopBackOff` means a container repeatedly failed; readiness failure keeps the Pod from receiving traffic.

## CI/CD optional example

`.github/workflows/container-publish.yml` publishes immutable commit SHA tags for both images to GHCR when you push to `main`. **It does not automatically deploy to Kubernetes.** Production-style deployments need a reachable cluster, credentials, image access permissions, and a deployment stage. Do not check credentials into Git. Use short-lived credentials or your organization's secret-management practices.

Official reference docs:

- https://docs.docker.com/compose/gettingstarted/
- https://kind.sigs.k8s.io/docs/user/quick-start/
- https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- https://kubernetes.io/docs/concepts/services-networking/service/
- https://docs.github.com/en/actions
