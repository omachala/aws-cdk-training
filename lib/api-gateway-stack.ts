import {
  AwsIntegration,
  MethodOptions,
  PassthroughBehavior,
  RestApi
} from "@aws-cdk/aws-apigateway";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import {
  Effect,
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal
} from "@aws-cdk/aws-iam";
import { ARecord, HostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import { ApiGateway } from "@aws-cdk/aws-route53-targets";
import { Queue } from "@aws-cdk/aws-sqs";
import { Construct, Stack, StackProps } from '@aws-cdk/core';

export class ApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create ApiGateway
    const api = new RestApi(this, "CdkApiGateway");
    // Create SQS queue
    const sqs = new Queue(this, "CdkQueue", {});

    // Create IAM Role
    const credentialsRole = new Role(this, "CdkSQSRole", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });

    // Attach policy allowing sending messages to SQS
    credentialsRole.attachInlinePolicy(
      new Policy(this, "CdkSendMessagePolicy", {
        statements: [
          new PolicyStatement({
            actions: ["sqs:SendMessage"],
            effect: Effect.ALLOW,
            resources: [sqs.queueArn],
          }),
        ],
      })
    );

    // Create 'queue' ApiGateway resource
    const apiResource = api.root.addResource("queue");

    // Integrate ApiGateway with SQS
    // - request is expected to be: application/x-www-form-urlencoded
    // - response will be: application/json
    const apiIntegration = new AwsIntegration({
      service: "sqs",
      path: sqs.queueName,
      integrationHttpMethod: "POST",
      options: {
        credentialsRole,
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestParameters: {
          "integration.request.header.Content-Type": `'application/x-www-form-urlencoded'`,
        },
        requestTemplates: {
          "application/json":
            "Action=SendMessage&MessageBody=$util.urlEncode($input.body)",
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": JSON.stringify({ done: true }),
            },
          },
        ],
      },
    });

    // Specify Method Options
    const apiMethodOptions: MethodOptions = {
      methodResponses: [{ statusCode: "200" }],
    };

    // Add POST method to my api resource (/queue)
    // with request/response behavior
    apiResource.addMethod("POST", apiIntegration, apiMethodOptions);

    // --- CUSTOM DOMAIN ROUTING ---

    // Load certificate for the domain (needs to be *.domain.tld for subdomain)
    const certificate = Certificate.fromCertificateArn(
      this,
      `CdkCertificate`,
      process.env.CERTIFICATE_ARN ?? '' // arn:aws:acm:xxxxx..
    );

    // Add (sub)domain to the ApiGateway
    api.addDomainName("CdkApiGatewayDomainName", {
      certificate,
      domainName: process.env.API_SUBDOMAIN ?? '', // api.domain.tld
    });

    // Load Hosted Zone
    const zone = HostedZone.fromLookup(this, "CdkZone", {
      domainName: process.env.DOMAIN ?? '', // domain.tld
    });

    // Create A Record, recordName must be the (sub)domain name
    new ARecord(this, "CdkDomainARecord", {
      zone,
      recordName: process.env.API_SUBDOMAIN ?? '', // api.domain.tld
      target: RecordTarget.fromAlias(new ApiGateway(api)),
    });
  }
}
