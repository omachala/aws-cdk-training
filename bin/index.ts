#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
import { ApiGatewayStack } from "../lib/api-gateway-stack";
import { Fargate2Stack } from "../lib/fargate-stack";
import { CodeBuildStack } from "../lib/code-build-stack";

import * as dotenv from "dotenv";
dotenv.config();

const app = new cdk.App();

const env = {
  region: process.env.REGION,
  account: process.env.ACCOUNT,
};

new Fargate2Stack(app, "FargateStack", { env });
new ApiGatewayStack(app, "ApiGatewayStack", { env });
new CodeBuildStack(app, "CodeBuildStack", { env });
