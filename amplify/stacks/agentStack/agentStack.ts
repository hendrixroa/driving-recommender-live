import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';

export function agentStack(backend: any, geoResources: any) {
  const { placeIndex, routeCalculator } = geoResources;

  backend.agentFunction.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: [
        'geo:SearchPlaceIndexForText',
        'geo:SearchPlaceIndexForPosition',
        'geo:GetPlace',
        'geo:CalculateRoute'
      ],
      resources: [
        placeIndex.attrArn,
        routeCalculator.attrArn
      ]
    })
  );

  backend.agentFunction.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      resources: ['*']
    })
  );

  const agentFunctionUrl = backend.agentFunction.resources.lambda.addFunctionUrl({
    authType: FunctionUrlAuthType.NONE,
    cors: {
      allowedOrigins: ['*'],
      allowedMethods: [HttpMethod.ALL],
      allowedHeaders: ['*'],
      maxAge: Duration.seconds(300)
    }
  });

  new CfnOutput(backend.stack, 'AgentFunctionUrl', {
    value: agentFunctionUrl.url,
    description: 'Agent Function URL'
  });

  backend.addOutput({
    custom: {
      agentFunctionUrl: agentFunctionUrl.url
    }
  });

  return {
    agentFunctionUrl
  };
}
