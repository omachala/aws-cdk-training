import {
  Cors,
  LambdaIntegration,
  RestApi,
  TokenAuthorizer,
} from "@aws-cdk/aws-apigateway";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { AttributeType, Table } from "@aws-cdk/aws-dynamodb";
import { AssetCode, Function, Runtime } from "@aws-cdk/aws-lambda";
import { ARecord, HostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import { ApiGateway } from "@aws-cdk/aws-route53-targets";
import {
  Construct,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "@aws-cdk/core";

export class Api101Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const dynamoTable = new Table(this, "Api101Votes", {
      partitionKey: {
        name: "userId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "postId",
        type: AttributeType.STRING,
      },
      tableName: "votes",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const cacheTable = new Table(this, "Api101VotesCache", {
      partitionKey: {
        name: "id",
        type: AttributeType.NUMBER,
      },
      tableName: "votes-cache",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userUpsertLambda = new Function(this, "Api101Upsert", {
      code: new AssetCode("api101Lambdas/user-upsert"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        CACHE_TABLE_NAME: cacheTable.tableName
      },
    });

    const userGetLambda = new Function(this, "Api101UpsertGetOne", {
      code: new AssetCode("api101Lambdas/user-get"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
      },
    });

    const getAllLambda = new Function(this, "Api101GetAll", {
      code: new AssetCode("api101Lambdas/get-all"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        CACHE_TABLE_NAME: cacheTable.tableName,
        PRIMARY_KEY: "id",
      },
    });

    dynamoTable.grantReadData(getAllLambda);
    dynamoTable.grantReadWriteData(userUpsertLambda);
    cacheTable.grantReadWriteData(getAllLambda);
    cacheTable.grantReadWriteData(userUpsertLambda);

    // Need to create index for userId in order to query data by userId
    dynamoTable.addGlobalSecondaryIndex({
      indexName: "userIdIndex",
      partitionKey: {
        name: "userId",
        type: AttributeType.STRING,
      },
    });

    dynamoTable.grantReadData(userGetLambda);

    const api = new RestApi(this, "Api101Rest", {
      restApiName: "Api101Rest",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
      },
    });

    const authFn = new Function(this, "Api101Auth", {
      code: new AssetCode("api101Lambdas/auth"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_12_X,
      environment: {
        SCOPE_ARN: api.arnForExecuteApi(),
      },
    });

    const authorizer = new TokenAuthorizer(this, "Api101TokenAuthorizer", {
      handler: authFn,
      resultsCacheTtl: Duration.minutes(10),
    });

    const resources = api.root;

    const getAllIntegration = new LambdaIntegration(getAllLambda);
    resources.addMethod("GET", getAllIntegration);

    const userResource = resources.addResource("user");

    const upsertIntegration = new LambdaIntegration(userUpsertLambda);
    userResource.addMethod("POST", upsertIntegration, { authorizer });

    const getOneIntegration = new LambdaIntegration(userGetLambda);
    userResource.addMethod("GET", getOneIntegration, { authorizer });

    // --- CUSTOM DOMAIN ROUTING ---

    const certificate = Certificate.fromCertificateArn(
      this,
      "Api101Certificate",
      process.env.API_101_CERTIFICATE_ARN ?? ""
    );

    api.addDomainName("Api101ApiGatewayDomainName", {
      certificate,
      domainName: process.env.API_101_SUBDOMAIN ?? "",
    });

    const zone = HostedZone.fromLookup(this, "Api101Zone", {
      domainName: process.env.API_101_DOMAIN ?? "",
    });

    new ARecord(this, "Api101DomainARecord", {
      zone,
      recordName: process.env.API_101_SUBDOMAIN ?? "",
      target: RecordTarget.fromAlias(new ApiGateway(api)),
    });
  }
}
