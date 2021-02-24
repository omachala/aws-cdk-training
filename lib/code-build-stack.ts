import { DnsValidatedCertificate } from "@aws-cdk/aws-certificatemanager";
import {
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  ViewerCertificate,
  ViewerProtocolPolicy,
} from "@aws-cdk/aws-cloudfront";
import {
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
} from "@aws-cdk/aws-codebuild";
import { Artifact, Pipeline } from "@aws-cdk/aws-codepipeline";
import {
  CodeBuildAction,
  GitHubSourceAction,
  GitHubTrigger,
  S3DeployAction,
} from "@aws-cdk/aws-codepipeline-actions";
import { PolicyStatement } from "@aws-cdk/aws-iam";
import { ARecord, HostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import { CloudFrontTarget } from "@aws-cdk/aws-route53-targets";
import { Bucket } from "@aws-cdk/aws-s3";
import { Construct, SecretValue, Stack, StackProps } from "@aws-cdk/core";

export class CodeBuildStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const buildProject = new PipelineProject(this, "CdkBuildProject", {
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: ["yarn install --frozen-lockfile"],
          },
          build: {
            commands: ["yarn build"],
          },
        },
        artifacts: {
          "base-directory": "./public",
          files: ["**/*"],
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
      },
    });

    const sourceOutput = new Artifact();
    const buildOutput = new Artifact("CdkBuildOutput");

    const targetBucket = new Bucket(this, "CdkBucket", {
      publicReadAccess: true,
    });

    const zone = HostedZone.fromLookup(this, "CdkZone", {
      domainName: String(process.env.CODEBUILD_TARGET_DOMAIN),
    });

    const certificate = new DnsValidatedCertificate(
      this,
      "CdkCrossRegionCertificate",
      {
        domainName: String(process.env.CODEBUILD_TARGET_DOMAIN),
        hostedZone: zone,
        subjectAlternativeNames: [`*.${process.env.CODEBUILD_TARGET_DOMAIN}`],
        region: "us-east-1", // needs to be 'us-east-1' for Cloudfront
      }
    );

    // ref: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-cloudfront-readme.html#acm-certificate
    const distribution = new CloudFrontWebDistribution(
      this,
      "CdkDistribution",
      {
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: targetBucket,
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                allowedMethods: CloudFrontAllowedMethods.GET_HEAD,
              },
            ],
          },
        ],
        viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate, {
          aliases: [
            `${String(process.env.CODEBUILD_TARGET_DOMAIN)}`,
            `www.${String(process.env.CODEBUILD_TARGET_DOMAIN)}`,
          ],
        }),
      }
    );

    new ARecord(this, "CdkDomainARecord", {
      zone,
      recordName: String(process.env.CODEBUILD_TARGET_DOMAIN),
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    // More options Cloudfront options here:
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-cloudfront-readme.html#domain-names-and-certificates

    // CLOUDFRONT INVALIDATIONS
    // There is currently no native support in CodePipeline for invalidating a CloudFront cache after deployment

    const invalidateBuildProject = new PipelineProject(
      this,
      "CDKnvalidateProject",
      {
        buildSpec: BuildSpec.fromObject({
          version: "0.2",
          phases: {
            build: {
              commands: [
                'aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths "/*"',
              ],
            },
          },
        }),
        environmentVariables: {
          CLOUDFRONT_ID: { value: distribution.distributionId },
        },
      }
    );

    const distributionArn = `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`;

    invalidateBuildProject.addToRolePolicy(
      new PolicyStatement({
        resources: [distributionArn],
        actions: ["cloudfront:CreateInvalidation"],
      })
    );

    // BUILD PIPELINE

    const pipeline = new Pipeline(this, "CdkPipeline");

    const sourceStage = pipeline.addStage({
      stageName: "Source",
      actions: [
        new GitHubSourceAction({
          actionName: "GitHub_Source",
          owner: String(process.env.GITHUB_OWNER),
          repo: String(process.env.GITHUB_REPO),
          // personal access token with repo, webhooks permissions
          // oauthToken: SecretValue.secretsManager(process.env.GITHUB_TOKEN || ''),
          oauthToken: SecretValue.plainText(String(process.env.GITHUB_TOKEN)),
          output: sourceOutput,
          branch: "master",
          trigger: GitHubTrigger.WEBHOOK,
        }),
      ],
    });

    pipeline.addStage({
      stageName: "CdkBuildStage",
      placement: {
        justAfter: sourceStage,
      },
      actions: [
        new CodeBuildAction({
          actionName: "CdkCodeBuildAction",
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    pipeline.addStage({
      stageName: "CdkDeployStage",
      actions: [
        new S3DeployAction({
          actionName: "CdkS3Deploy",
          bucket: targetBucket,
          input: buildOutput,
          runOrder: 1,
        }),
        new CodeBuildAction({
          actionName: "CdkInvalidateCache",
          project: invalidateBuildProject,
          input: buildOutput,
          runOrder: 2,
        }),
      ],
    });
  }
}
