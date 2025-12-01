/**
 * Agent Function Lambda Handler
 * Processes voice input using LLM-powered workflow
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { createLLMProvider } from './llm-provider.js';
import { runVoiceRoutePlanningWorkflow } from './workflow.js';
import { ConversationContext } from './types.js';

let llmProvider: any;

try {
  llmProvider = createLLMProvider();
  console.log('LLM provider initialized successfully');
} catch (error) {
  console.error('Error initializing LLM provider:', error);
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Agent function invoked', { 
    provider: llmProvider.getName(),
    path: event.path,
    method: event.httpMethod 
  });

  // Headers (CORS is handled by Function URL configuration)
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    if (!llmProvider) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'LLM provider not initialized',
          message: 'Check CloudWatch logs for initialization errors'
        })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { text, context } = body;

    if (!text) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required field: text' 
        })
      };
    }

    const conversationContext: ConversationContext = {
      userId: context?.userId || 'anonymous',
      sessionId: context?.sessionId || generateSessionId(),
      previousQueries: context?.previousQueries || [],
      currentLocation: context?.currentLocation
    };

    const startTime = Date.now();
    const response = await runVoiceRoutePlanningWorkflow(llmProvider, text, conversationContext);
    const processingTime = Date.now() - startTime;

    console.log('Workflow completed', { 
      processingTime,
      responseType: response.type,
      confidence: response.confidence
    });

    if (processingTime > 5000) {
      console.warn('Agent response time exceeded threshold', { processingTime });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...response,
        processingTime,
        provider: llmProvider.getName()
      })
    };
  } catch (error) {
    console.error('Error in agent function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
