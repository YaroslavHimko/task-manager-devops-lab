# Interview preparation — .NET + Angular + Docker + Kubernetes + Linux

Learn the answers, then demonstrate them using the lab. This is a beginner-to-intermediate checklist, not proof of production expertise.

## Linux basics

**1. How do you locate an application log in Linux?** For systemd services: `journalctl -u my-service`; for containers: `docker logs CONTAINER` or `kubectl logs POD`. Also inspect configured logging destinations.

**2. How do you check a listening port?** `ss -lntp` (permissions may affect process details), and `curl -i http://localhost:PORT/path` to test HTTP.

**3. What do file permissions mean?** Read/write/execute for owner, group, others. `chmod` changes mode; `chown` changes owner. Do not run production workloads as root without reason.

**4. How is Linux process management different from Windows services?** `systemd` often manages Linux system services (`systemctl status NAME`), but inside containers a foreground process is started directly as PID 1.

## Docker

**5. Docker image vs Docker container?** Image = packaged build artifact and metadata; container = runtime instance with its own writable layer and process.

**6. `RUN` vs `CMD` vs `ENTRYPOINT`?** `RUN` builds an image layer. `CMD` provides defaults at runtime. `ENTRYPOINT` defines the runtime executable/entrypoint.

**7. Why multi-stage builds?** Compile using full SDK/tooling and copy only publish/static output into a smaller runtime image; this reduces unnecessary runtime dependencies.

**8. How do containers talk to one another?** Docker Compose creates a network with service-name DNS; `api` resolves to its container's network address. Only the frontend needs its port published for the browser.

**9. Why not use `localhost` for container-to-container requests?** In a container, `localhost` points back to that same container, not another one.

**10. How do you persist data?** Volumes or an external database. In this lab the API memory is ephemeral; changing container lifetime deletes the tasks.

## Kubernetes

**11. Pod vs Deployment vs Service?** Pod = deployable unit; Deployment controls desired Pod replicas and version; Service gives stable service discovery/address for selected Pods.

**12. What is a readiness probe?** A health check that determines whether a Pod should receive traffic. A liveness probe determines whether its container should be restarted.

**13. What is a rolling update?** Kubernetes updates Pods incrementally according to Deployment strategy to avoid taking every replica offline at once; verify with `kubectl rollout status`.

**14. Why are container images in a registry?** Kubernetes nodes need to pull the exact image built by CI. In this local lab, kind can load images directly instead.

**15. Why is a Service necessary if Pods already have IP addresses?** Pod identities/IP addresses change on restart/rollout. A Service offers a stable DNS name and selects healthy Pod endpoints.

**16. What is `CrashLoopBackOff`?** Kubernetes repeatedly restarts a container that exits/crashes and backs off between retries. Debug via `kubectl describe pod` and `kubectl logs --previous`.

**17. What is `ImagePullBackOff`?** Kubernetes cannot fetch an image: wrong tag, missing credentials, unreachable registry, or image not loaded into kind.

**18. How would you scale a backend safely?** Make app stateless, put shared state in a DB/cache, manage sessions/secrets externally, configure readiness probes and resource limits, then increase replicas.

**19. What are requests and limits?** Requests inform Kubernetes scheduling; limits bound resource consumption (with differences in how CPU and memory enforcement behave).

**20. What is the difference between `kubectl port-forward` and production ingress?** Port-forward tunnels a local development/debugging connection. Public production access uses supported routing mechanisms such as Ingress/Gateway/load balancers with HTTPS.

## Angular vs React

**21. What does `signal()` do in Angular?** Holds reactive state and notifies Angular when it changes. `tasks.set(...)` replaces it and `tasks.update(...)` transforms it.

**22. How does Angular call .NET?** Angular injects `HttpClient`, calls HTTP endpoints using same-origin `/api`, and Nginx proxies `/api` to ASP.NET.

**23. Why use `@for (task of tasks(); track task.id)`?** Efficiently renders a keyed list as state changes, analogous to stable `key` props in React `.map()`.

**24. What is dependency injection?** A framework feature for supplying services/dependencies to classes (Angular `inject(HttpClient)`; ASP.NET DI also supports constructor/parameter injection).

## Scenario questions

**25. A browser returns 502:** Check frontend proxy log, API container/Pod health, DNS/service name, port configuration and routing, readiness status. Reproduce using `curl` along the path.

**26. Works with Compose, fails on Kubernetes:** Look for missing image load or registry, wrong imagePullPolicy, Service selectors and port mismatches, DNS, environment variables, health checks, and missing configuration/secrets.

**27. Two replicas show inconsistent tasks:** This lab uses in-memory data. Each API process has independent data. Move state to a shared database.

**28. A new release is broken:** Inspect rollout, logs and events; if necessary `kubectl rollout undo deployment/NAME`, then diagnose in staging.

**29. What does a CI/CD pipeline do?** Restore/test/build code, create versioned images, scan them, push to registry, deploy to Kubernetes, and verify rollout/health, with approvals and rollback controls when appropriate.

**30. What would you improve first for production?** Database + migrations, secrets, authentication and authorization, TLS/ingress, pinned image versions, CI/CD, observability, security, and backups.

## 60-second interview explanation of your lab

"I built a small Angular client with signals and HttpClient and an ASP.NET Core minimal API. I used multi-stage Dockerfiles to build the .NET application and the Angular static assets. The frontend image runs Nginx, which serves Angular and reverse-proxies `/api` to the backend service. I first ran both containers with Docker Compose. Then I deployed the same images into a local kind Kubernetes cluster using two Deployments and two ClusterIP Services, with readiness and liveness probes. I used kubectl to inspect pods, view logs, scale the frontend, simulate an API outage, and perform a versioned UI rollout. The example has in-memory storage, so I would introduce a shared database before scaling the API in production." 
