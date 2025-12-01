/**
 * LLM Provider Strategy Pattern
 * Supports both AWS Bedrock and Google Gemini
 */

export interface LLMProvider {
  generateResponse(prompt: string): Promise<string>;
  getName(): string;
}

export class BedrockProvider implements LLMProvider {
  private client: any;
  private modelId: string;

  constructor() {
    // Lazy import to avoid loading SDK if not needed
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
  }

  async generateResponse(prompt: string): Promise<string> {
    // Lazy load AWS SDK
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    
    if (!this.client) {
      this.client = new BedrockRuntimeClient({ 
        region: process.env.AWS_REGION || 'us-east-1' 
      });
    }

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.content[0].text;
  }

  getName(): string {
    return 'AWS Bedrock';
  }
}

export class GeminiProvider implements LLMProvider {
  private client: any;
  private model: any;

  constructor() {
    // Lazy import to avoid loading SDK if not needed
  }

  async generateResponse(prompt: string): Promise<string> {
    // Lazy load Google Generative AI SDK
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      
      this.client = new GoogleGenerativeAI(apiKey);
      this.model = this.client.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-pro' 
      });
    }

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  getName(): string {
    return 'Google Gemini';
  }
}

/**
 * Factory function to create the appropriate LLM provider based on environment variable
 */
export function createLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'bedrock';
  
  switch (provider.toLowerCase()) {
    case 'bedrock':
      console.log('Using AWS Bedrock as LLM provider');
      return new BedrockProvider();
    case 'gemini':
      console.log('Using Google Gemini as LLM provider');
      return new GeminiProvider();
    default:
      console.warn(`Unknown LLM provider: ${provider}, defaulting to Bedrock`);
      return new BedrockProvider();
  }
}
