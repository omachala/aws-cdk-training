#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import * as dotenv from "dotenv";
import "source-map-support/register";
import { ApiLambdaCrudDynamoDBStack } from "../lib/api-crud-stack";
import { ApiGatewayStack } from "../lib/api-gateway-stack";
import { CodeBuildStack } from "../lib/code-build-stack";
import { Fargate2Stack } from "../lib/fargate-stack";
import { Api101Stack } from "../lib/api-101-stack";

dotenv.config();

const app = new cdk.App();

const env = {
  region: process.env.REGION,
  account: process.env.ACCOUNT,
};

new Fargate2Stack(app, "FargateStack", { env });
new ApiGatewayStack(app, "ApiGatewayStack", { env });
new CodeBuildStack(app, "CodeBuildStack", { env });
new ApiLambdaCrudDynamoDBStack(app, "ApiLambdaCrudDynamoDBStack", { env });

const api101Env = {
  region: process.env.API_101_REGION,
  account: process.env.ACCOUNT,
};
new Api101Stack(app, "Api101Stack", { env: api101Env });
