import { Injectable } from '@nestjs/common';
import { PolicyHandler } from './policy.decorator';

@Injectable()
export class PolicyHandlerBase implements PolicyHandler {
  constructor(private condition: string) {}

  handle(user: any, resource: any): boolean {
    try {
      const context = { subject: user, resource };
      const evaluator = new Function('context', `
        const { subject, resource } = context;
        return ${this.condition};
      `);
      
      return evaluator(context);
    } catch (error) {
      console.error('Policy evaluation error:', error);
      return false;
    }
  }
}