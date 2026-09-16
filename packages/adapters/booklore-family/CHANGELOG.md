# @latestarr/adapter-booklore-family

## 0.6.0

### Patch Changes

- @latestarr/adapter-core@0.6.0

## 0.5.0

### Patch Changes

- @latestarr/adapter-core@0.5.0

## 0.4.6

### Patch Changes

- @latestarr/adapter-core@0.4.6

## 0.4.5

### Patch Changes

- @latestarr/adapter-core@0.4.5

## 0.4.4

### Patch Changes

- @latestarr/adapter-core@0.4.4

## 0.4.3

### Patch Changes

- @latestarr/adapter-core@0.4.3

## 0.4.2

### Patch Changes

- @latestarr/adapter-core@0.4.2

## 0.4.1

### Patch Changes

- @latestarr/adapter-core@0.4.1

## 0.4.0

### Patch Changes

- @latestarr/adapter-core@0.4.0

## 0.3.0

### Patch Changes

- @latestarr/adapter-core@0.3.0

## 0.2.0

### Minor Changes

- 20b13fd: Add a BookLore-family adapter (`@latestarr/adapter-booklore-family`) covering BookLore and its compatible forks BookOrbit and Grimmory. These expose their library through OPDS (a standardized Atom-based catalog format, HTTP Basic Auth) rather than a stable internal REST API, so this adapter parses OPDS feeds directly. Since all three forks share the same OPDS surface, this ships as a single adapter factory rather than three near-duplicate implementations — `bookloreAdapter`, `bookOrbitAdapter`, and `grimmoryAdapter` differ only in their `kind` identifier.

### Patch Changes

- Updated dependencies [dc5a521]
  - @latestarr/adapter-core@0.2.0
