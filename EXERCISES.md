# Practical exercises — learn by doing

Work through these in order. Each exercise has a success condition you can verify.

## Level 1 — make a code change
1. In `api/Program.cs` add one more initial task, restart Docker Compose with `docker compose up --build -d`, and verify it in the browser.
2. In `frontend/src/app/app.component.html` change the `<h1>` text; rebuild and verify the UI.
3. Use `curl -i -X POST ...` to create a task without the browser. Explain what a 201 response means.

## Level 2 — understand containers
4. Run `docker images`, `docker ps`, and `docker compose logs -f api`. Explain which item is an image vs a container.
5. Run `docker compose exec frontend sh`, inspect `/usr/share/nginx/html` and `/etc/nginx/conf.d/default.conf`, exit the shell.
6. Remove the API container with `docker compose down` and start it again. Why did the created task disappear?

## Level 3 — Kubernetes
7. Deploy to kind with the README commands; identify the Deployments, Pods, and Services using `kubectl get ...`.
8. Scale frontend from 2 to 3 replicas and observe Pod creation. Verify the site still works.
9. Scale backend to zero: explain and observe the 502 from Nginx; scale back to one.
10. Delete one frontend Pod using `kubectl delete pod <NAME>` and run `kubectl get pods -w`. Explain who creates the replacement.

## Level 4 — realistic code rollout
11. Change UI heading to `Version 2`.
12. Build a new tagged image from project root:

```bash
docker build -t interview-frontend:v2 ./frontend
kind load docker-image interview-frontend:v2 --name interview-lab
kubectl set image deployment/frontend frontend=interview-frontend:v2
kubectl rollout status deployment/frontend
kubectl rollout history deployment/frontend
```

13. Verify the new UI, then rollback:

```bash
kubectl rollout undo deployment/frontend
kubectl rollout status deployment/frontend
```

If the previous image is no longer available in your kind cluster, reload it with `kind load docker-image interview-frontend:v1 --name interview-lab`.

## Level 5 — step toward real production
14. Explain why a shared relational database would be needed before scaling API replicas.
15. Name the missing production pieces: managed secrets, TLS/HTTPS, public ingress/load balancing, CI/CD, backups, metrics, centralized logs, security scanning, resource limits, and database persistence.
