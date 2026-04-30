// Global setup for Vitest — loads reflect-metadata before any test file.
// NestJS decorators (like @Injectable, @Controller) rely on decorator metadata
// which requires this polyfill to be loaded before class definitions.
import 'reflect-metadata';
