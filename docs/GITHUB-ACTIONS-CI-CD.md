# GitHub Actions CI/CD for the Task Manager lab

This guide extends the `.NET 10 + Angular + Docker Compose + kind` lab with **CI and optional local CD**. The complete ready-to-push workflow is `.github/workflows/ci-cd.yml`.

## Pipeline architecture

- Pull request -> GitHub-hosted Ubuntu runner -> Docker Compose build and smoke tests -> pass/fail. No image publishing.
- Push to `main` -> verify -> publish unique SHA-tagged `.NET` and Angular images to private GitHub Container Registry (GHCR).
- Optional: if repository variable `ENABLE_LOCAL_CD=true` and a trusted self-hosted runner is available in the same Ubuntu environment as your kind cluster, the runner pulls the private images using `GITHUB_TOKEN`, loads them into kind, and updates both Deployments.

Why the special runner? GitHub-hosted runners cannot connect to a kind cluster on your personal computer. On a sleeping/offline computer, the deploy job cannot run. On your first push, leave deployment disabled.

## 1. Create the private repository

GitHub > New repository > choose a name such as `task-manager-devops-lab` > Private. For the simplest push, avoid generating README/.gitignore from GitHub because they already exist in the archive.

From the extracted lab root (the folder containing `api/`, `frontend/`, `k8s/`, `compose.yaml`, `.github/`):

```bash
git init
git branch -M main
git add .
git commit -m "Initial .NET Angular DevOps lab"
git remote add origin https://github.com/YOUR_USER/task-manager-devops-lab.git
git push -u origin main
```

Authenticate through Git Credential Manager or SSH. Do not commit tokens, kubeconfig, `.env` secrets or private keys. Make sure the `.github/workflows/ci-cd.yml` file appears in GitHub.

## 2. Start with hosted CI and publishing

Open your repository's **Actions** tab and select **CI and CD - Task Manager**. The workflow starts on push to `main` or can be started by **Run workflow**. It performs:

- `verify`: `docker compose up --build -d`, HTTP `/api/health`, `/api/tasks`, and `/` smoke tests. It always shuts down test containers afterward.
- `publish`: only after `verify` succeeds and only on `main` pushes / manual runs. Builds and pushes API and Angular images to `ghcr.io/YOUR_USER/interview-api:<full-commit-sha>` and `ghcr.io/YOUR_USER/interview-frontend:<full-commit-sha>` and updates `:main` tags.
- `deploy`: skipped by default, because the repository variable `ENABLE_LOCAL_CD` is not `true`.

`GITHUB_TOKEN` is automatically provided; you do NOT create a PAT to push from the same repository workflow. The publish job requests `packages: write`. Private GHCR packages may need their Actions access linked to the repository if pre-existing.

**Important:** This initial lab has build-and-HTTP smoke checks but no unit-test project. For production, add `dotnet test`, frontend unit tests, security scanning, and stronger gating.

## 3. Verify success

After the green workflow, open GitHub profile/organization > Packages to view the two container packages. The image name is `ghcr.io/<lowercase-owner>/interview-api:<SHA>` and likewise for `interview-frontend`. Package privacy is separate from repo visibility; do not turn it public just to make the lab work.

## 4. Prepare kind for initial deployment (one-time)

On the same Ubuntu instance where your existing kind cluster runs:

```bash
kind get clusters
kubectl --context kind-interview-lab get nodes
kubectl --context kind-interview-lab apply -f k8s/
kubectl --context kind-interview-lab get deployment api frontend
```

If the original `interview-api:v1` and `interview-frontend:v1` images are not loaded, Pods may temporarily show `ImagePullBackOff`. That is expected until the deploy job loads and switches them to the newly published SHA images.

Make sure `docker`, `kind`, `kubectl` all work **for the same Linux user who will run the self-hosted runner**.

## 5. Add a self-hosted deployment runner (optional)

GitHub repository > Settings > Actions > Runners > New self-hosted runner > Linux x64. Follow GitHub's exact commands to download/configure the runner **in the Ubuntu instance with Docker Desktop integration and the local kind cluster**. Do not invent or reuse runner registration tokens; GitHub generates a one-time token.

Assign the custom runner label `deploy-kind` using GitHub UI or the registration command's `--labels deploy-kind` option. The workflow expects labels `[self-hosted, linux, x64, deploy-kind]`.

For first practice, run the runner interactively with `./run.sh` as the same Linux user whose `$HOME/.kube/config` contains `kind-interview-lab`. Verify its runner status is **Idle** in GitHub. Keep Docker Desktop, the cluster and the runner running.

**Security:** Keep this runner restricted to a trusted private repository and protect `main`. Never run untrusted pull requests on this runner. It can access your local Docker Engine and kubeconfig. For professional deployments prefer isolated deployment runners and short-lived workload identity credentials.

## 6. Enable automatic deployment

Repository > Settings > Secrets and variables > Actions > **Variables** tab > New repository variable:

- Name: `ENABLE_LOCAL_CD`
- Value: `true`

This is a nonsecret flag. No extra PAT or kubeconfig secret is needed for this *same-machine kind lab*. Push a small commit to `main` (or run the workflow manually). GitHub checks/builds, publishes images, then starts `deploy` on your labeled runner.

The deploy job:

```bash
docker pull ghcr.io/YOUR_USER/interview-api:<SHA>
kind load docker-image ghcr.io/YOUR_USER/interview-api:<SHA> --name interview-lab
kubectl --context kind-interview-lab set image deployment/api api=ghcr.io/YOUR_USER/interview-api:<SHA>
kubectl --context kind-interview-lab rollout status deployment/api --timeout=180s
```

The workflow does equivalent commands for the frontend too. It uses the automatically scoped `GITHUB_TOKEN` to authenticate to private GHCR during its execution. `kind load` places the images directly into the local cluster's node image store; the lab manifest uses `imagePullPolicy: IfNotPresent`, so Kubernetes does not need to pull them from GHCR again.

For a real multi-node Kubernetes cluster, this shortcut is not appropriate: the cluster needs its own GHCR pull credentials (`imagePullSecrets`) or another registry access mechanism available to **each node**.

## 7. Verify your new deployment

```bash
kubectl --context kind-interview-lab get pods
kubectl --context kind-interview-lab get deployments
kubectl --context kind-interview-lab get deployment api -o=jsonpath='{.spec.template.spec.containers[0].image}'
```

To view the app from the same machine, keep this command running in a separate terminal:

```bash
kubectl --context kind-interview-lab port-forward service/frontend 8080:80
```

Then in another terminal:

```bash
curl -i http://127.0.0.1:8080/api/health
```

**Important:** The CI/CD workflow does not keep `kubectl port-forward` alive. The port-forward stops when its session ends. Also stop Docker Compose (`docker compose down`) if port 8080 is already in use. Otherwise forward `8081:80` and use `http://127.0.0.1:8081`.

## 8. Troubleshooting

| Symptom | What to check |
| --- | --- |
| CI build fails | Actions > verify job > Docker Compose logs. The lab does not contain `package-lock.json`; the Dockerfile uses `npm install` instead of `npm ci` for now. |
| GHCR push 403 | `packages: write`, package-to-repository Actions access, owner/name conflicts and organization permissions. |
| Deployment is skipped | `ENABLE_LOCAL_CD` variable must equal `true`. |
| Deployment is queued forever | Self-hosted runner offline, wrong runner label, asleep computer or Docker Desktop not running. |
| Cannot access kind | Runner user must have the correct `$HOME/.kube/config`, kind context, Docker socket and cluster running. |
| ImagePullBackOff after deploy | Inspect `kind load` logs and image names. Verify correct `kind` cluster and `IfNotPresent`. |
| Rollout stuck | `kubectl get pods`, `kubectl describe pod`, `kubectl logs deployment/api`. |
| curl localhost:8080 connection refused | No port-forward process is currently listening, or wrong host/port. |

## 9. Manual rollback

```bash
kubectl --context kind-interview-lab rollout history deployment/api
kubectl --context kind-interview-lab rollout undo deployment/api
kubectl --context kind-interview-lab rollout status deployment/api
```

Rollback applies previous Kubernetes Deployment image/configuration, not database migrations. The demo API stores tasks in memory so they disappear on restart.

## Recommended next steps

1. Generate/commit `frontend/package-lock.json` using `npm install --package-lock-only` with a compatible Node version, then change the frontend Dockerfile to use `npm ci`.
2. Add proper API unit tests and `dotnet test`, plus frontend tests.
3. Add a staging environment and a real production cluster. Treat the local kind runner as a learning exercise, not a secure production deployment design.
4. Use trusted, pinned third-party action commit SHAs and approved dependencies in production.

Official references:
- https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
- https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners
- https://kind.sigs.k8s.io/docs/user/quick-start/
