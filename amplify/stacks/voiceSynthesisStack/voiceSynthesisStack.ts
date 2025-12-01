import { Stack, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function voiceSynthesisStack(backend: any) {
  const stack = backend.createStack("voice-synthesis-stack");

  const voiceSynthesisFunction = new lambda.DockerImageFunction(stack, 'VoiceSynthesisFunction', {
    functionName: 'voice-synthesis-function',
    code: lambda.DockerImageCode.fromImageAsset(join(__dirname, 'voice-synthesis'), {
      file: 'Dockerfile',
      platform: Platform.LINUX_ARM64,
    }),
    architecture: lambda.Architecture.ARM_64,
    timeout: Duration.seconds(30),
    memorySize: 2048,
    environment: {
      MODEL_PATH: '/var/task/models/es_ES-davefx-medium.onnx'
    },
    logRetention: logs.RetentionDays.ONE_WEEK,
    description: 'Piper TTS voice synthesis with Lambda Response Streaming',
    tracing: lambda.Tracing.ACTIVE,
  });

  const voiceSynthesisFunctionUrl = voiceSynthesisFunction.addFunctionUrl({
    authType: lambda.FunctionUrlAuthType.NONE,
    invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    cors: {
      allowedOrigins: ['*'],
      allowedMethods: [lambda.HttpMethod.ALL],
      allowedHeaders: ['*'],
      maxAge: Duration.days(1),
    },
  });

  backend.addOutput({
    custom: {
      voiceSynthesis: {
        functionUrl: voiceSynthesisFunctionUrl.url,
        region: Stack.of(stack).region,
      },
    },
  });

  return {
    voiceSynthesisFunction,
    voiceSynthesisFunctionUrl
  };
}
