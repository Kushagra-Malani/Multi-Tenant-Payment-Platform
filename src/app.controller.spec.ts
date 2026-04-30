import { describe, it, expect } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  describe('root', () => {
    it('should return "Hello World!"', () => {
      const appService = new AppService();
      const appController = new AppController(appService);
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
