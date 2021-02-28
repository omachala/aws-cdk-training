import {
  IResource,
  LambdaIntegration,
  MockIntegration,
  PassthroughBehavior,
  RestApi,
  TokenAuthorizer,
} from "@aws-cdk/aws-apigateway";
import { AttributeType, Table } from "@aws-cdk/aws-dynamodb";
import { AssetCode, Function, Runtime } from "@aws-cdk/aws-lambda";
import {
  Construct,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "@aws-cdk/core";

export class ApiLambdaCrudDynamoDBStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const dynamoTable = new Table(this, "items", {
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
      tableName: "items",
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    const getOneLambda = new Function(this, "getOneItemFunction", {
      code: new AssetCode("crudLambdas/get-one"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        PRIMARY_KEY: "id",
      },
    });

    const getAllLambda = new Function(this, "getAllItemsFunction", {
      code: new AssetCode("crudLambdas/get-all"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        PRIMARY_KEY: "id",
      },
    });

    const createOne = new Function(this, "createItemFunction", {
      code: new AssetCode("crudLambdas/create"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        PRIMARY_KEY: "id",
      },
    });

    const updateOne = new Function(this, "updateItemFunction", {
      code: new AssetCode("crudLambdas/update-one"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        PRIMARY_KEY: "id",
      },
    });

    const deleteOne = new Function(this, "deleteItemFunction", {
      code: new AssetCode("crudLambdas/delete-one"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        PRIMARY_KEY: "id",
      },
    });

    dynamoTable.grantReadWriteData(getAllLambda);
    dynamoTable.grantReadWriteData(getOneLambda);
    dynamoTable.grantReadWriteData(createOne);
    dynamoTable.grantReadWriteData(updateOne);
    dynamoTable.grantReadWriteData(deleteOne);

    const api = new RestApi(this, "itemsApi", {
      restApiName: "Items Service",
    });

    const authFn = new Function(this, "authLambda", {
      code: new AssetCode("crudLambdas/auth"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        SCOPE_ARN: api.arnForExecuteApi(), // arn for accessing all api endpoints
      },
    });

    const authorizer = new TokenAuthorizer(this, "Authorized", {
      handler: authFn,
      resultsCacheTtl: Duration.minutes(10),
    });

    const items = api.root; 

    const getAllIntegration = new LambdaIntegration(getAllLambda);
    items.addMethod("GET", getAllIntegration, { authorizer });

    const createOneIntegration = new LambdaIntegration(createOne);
    items.addMethod("POST", createOneIntegration, { authorizer });
    addCorsOptions(items);

    const singleItem = items.addResource("{id}");
    const getOneIntegration = new LambdaIntegration(getOneLambda);
    singleItem.addMethod("GET", getOneIntegration, { authorizer });

    const updateOneIntegration = new LambdaIntegration(updateOne);
    singleItem.addMethod("PATCH", updateOneIntegration, { authorizer });

    const deleteOneIntegration = new LambdaIntegration(deleteOne);
    singleItem.addMethod("DELETE", deleteOneIntegration, { authorizer });
    addCorsOptions(singleItem);
  }
}

export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers":
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Credentials":
              "'false'",
            "method.response.header.Access-Control-Allow-Methods":
              "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  );
}
