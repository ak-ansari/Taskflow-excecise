# TaskFlow API - My Journey

## Introduction

As i gone through the code base in my understanding it is a api server to manage user's tasks. user can perform following actions.

1. Register himself by providing unique email and password (not sure admin going to add user or user himself).

2. User can login using email and password.

3. User can add, update, delete, read his tasks after login only.

4. User can perform batch operations on tasks.

5. Scheduler is there to do some process automatically.

## Tech Stack

- **Language**: TypeScript
- **Framework**: NestJS
- **ORM**: TypeORM with PostgreSQL
- **Queue System**: BullMQ with Redis
- **API Style**: REST with JSON
- **Package Manager**: Bun
- **Testing**: Bun test

## My Findings

1. Improper dependency structure.
2. Apis are performing in memory filter and manual updates.
3. No Proper logging mechanism.
4. No Proper error handling.
5. No access control and security mechanism.
6. Anti Repository pattern (services directly interacting with databases)
7. In memory cache witch would not scale with multi instance deployment.

## What I Improved

### 1. Performance & Scalability

- Optimized query by quiring with manager (N+1 query problems throughout the application )
- Optimized API by getting desired result from query it self with help of COUNT query with conditions (Inefficient in-memory filtering and pagination that won't scale)
- Ridoff database roundtrips (Excessive database roundtrips in batch operations)
- Used transactions and manager pattern for data access (Poorly optimized data access patterns)

### 2. Architectural Weaknesses

- Implemented repository pattern service is only do business logic and database logic will be isolated inside the repository class makes the app database independent (Inappropriate separation of concerns (e.g., controllers directly using repositories))
- Implemented and refactored the code according to domain driven architecture (Missing domain abstractions and service boundaries)
- Used proper transactions to make sure consistency and role back on error (Lack of transaction management for multi-step operations)
- Segregated the domain specific logic to appropriate service (Tightly coupled components with high interdependency)

### 3. Security Vulnerabilities

- Improved auth module for secure access with implemented jwt strategy and appropriate guards (Inadequate authentication mechanism with several vulnerabilities)
- Handled authorization checks in roles guard (Improper authorization checks that can be bypassed) \\ i am not sure where to strictly use admin role and where user not found in instruction thats why i leave it as it is but i can implement if someone tell me about it
- Changes in error messages which is exposing critical information in errors (Unprotected sensitive data exposure in error responses)
- Added rate limiter guard in global for secure rate limiting (Insecure rate limiting implementation)

### 4. Reliability & Resilience Gaps

- Added exception filter to handle exceptions in global (Ineffective error handling strategies)
- Using bull mq which automatically handles retry according to provided configuration(Missing retry mechanisms for distributed operations)
- implemented in cache service if error occur while accessing cache it will return null hence it will be treated a cache miss same we can implement for queue but then we have to write our repository to interact with queues (Lack of graceful degradation capabilities)
- Implemented redis based caching (In-memory caching that fails in distributed environments)

## Implementation

### 1. Performance Optimization

- Optimized queries with joins and index to get desired from query itself in optimized manner (Implement efficient database query strategies with proper joins and eager loading)
- Created paginated query system with search and filter support for findAllTasks api (Create a performant filtering and pagination system)
- Optimized batch processing logic by bulk operations. divided task into small size chunks (Optimize batch operations with bulk database operations)
- Added index on frequently queried columns like userId, status, priority for task entity (Add appropriate indexing strategies)

### 2. Architectural Improvements

- Implemented proper domain separation and service abstractions
- Created a consistent transaction management strategy
- Applied SOLID principles throughout the codebase
- Implemented CQRS advanced pattern in task module, 

### 3. Security Enhancements

- Added refresh token rotation strategy with database security by saving hashed value of refresh token (Strengthen authentication with refresh token rotation)
- Implemented role based authorization with the help of roles guard (Implement proper authorization checks at multiple levels) // no clarity where to restrict user
- Created a comprehensive rate limiting guard (Create a secure rate limiting system)
- Added dtos for data validation and data is sensitized when updating (Add data validation and sanitization)

### 4. Resilience & Observability

- Added global exception filter (Implement comprehensive error handling and recovery mechanisms)
- Added logging interceptor (Add proper logging with contextual information)
- Added health check with termines (Create meaningful health checks)
- Added logger to observe access and logs . used pino for pretty and consistent logs (Implement at least one observability pattern)

## Advanced Challenge Areas

For senior engineers, we expect solutions to also address:

### 1. Distributed Systems Design

- Current solution is supports multi instance deployment because
 1. redis is used as cache i.e one centered cache for all instances. 
 2. Transactions is used for multi queries to ensure consistency.
 3. Rate limiter also designed to work in distributed environment.
 (Create solutions that work correctly in multi-instance deployments)
- Implemented redis based caching (Implement proper distributed caching with invalidation strategies)
- Using transactions  (Handle concurrent operations safely)
- Designed for horizontal scaling

### 2. Performance Under Load

- Optimized for high throughput scenarios
- Implemented backpressure mechanisms
- Created efficient resource utilization strategies
- Designed for predictable performance under varying loads
