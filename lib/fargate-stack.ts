import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { Port, Vpc } from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  ListenerConfig,
  Protocol,
} from "@aws-cdk/aws-ecs";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  CfnListener,
  CfnListenerProps,
} from "@aws-cdk/aws-elasticloadbalancingv2";
import { CnameRecord, HostedZone } from "@aws-cdk/aws-route53";
import * as cdk from "@aws-cdk/core";
import { CfnOutput, Construct, StackProps } from "@aws-cdk/core";
import { resolve } from "path";

export class Fargate2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Get existing VPC (or create new one)
    const vpc = Vpc.fromLookup(this, "VPC", { vpcId: process.env.VPC || '' }); // vpc-xxxx..

    // Create ECS Cluster
    const cluster = new Cluster(this, "CdkCluster", { vpc });

    // Create Fargate Task Definition
    const taskDefinition = new FargateTaskDefinition(this, "CdkTaskDefinition");

    // Add docker container to the task definition
    // My nodejs dockerApp server runs on port 3000
    // so I need to map this port
    taskDefinition
      .addContainer("CdkContainer", {
        image: ContainerImage.fromAsset(resolve(__dirname, "..", "dockerApp")),
        memoryLimitMiB: 256,
      })
      .addPortMappings({
        containerPort: Number(process.env.DOCKER_PORT), // 3000
        protocol: Protocol.TCP,
      });

    // Register new Fargate Service with taskDefition into cluster
    const service = new FargateService(this, "CdkFargateService", {
      cluster,
      taskDefinition,
      desiredCount: 2,
    });

    // Set Fargate Service scaling with max 10 instances + cpu and memory utilization
    const scaling = service.autoScaleTaskCount({ maxCapacity: 10 });

    scaling.scaleOnCpuUtilization("CdkCpuScaling", {
      targetUtilizationPercent: 80,
    });

    scaling.scaleOnMemoryUtilization("CdkMemoryScaling", {
      targetUtilizationPercent: 90,
    });

    // --- LOAD BALANCER ---

    // Create Application Load Balancer
    const loadBalancer = new ApplicationLoadBalancer(this, `CdkLoadBalancer`, {
      vpc: cluster.vpc,
      internetFacing: true,
      http2Enabled: true,
    });

    // Allow connection to ALB
    loadBalancer.connections.allowFromAnyIpv4(Port.tcp(80));

    // --- HTTPS ---

    // HTTP to HTTPS redirect on the ALB level
    const actionProperty: CfnListener.ActionProperty = {
      type: "redirect",
      redirectConfig: {
        statusCode: "HTTP_302",
        protocol: "HTTPS",
        port: "443",
      },
    };

    const redirectProps: CfnListenerProps = {
      defaultActions: [actionProperty],
      loadBalancerArn: loadBalancer.loadBalancerArn,
      port: 80,
      protocol: "HTTP",
    };

    new CfnListener(this, `CdkHttpRedirect`, redirectProps);

    // --- CUSTOM DOMAIN ROUTING ---

    // Load certificate for my domain (needs to be *.domain.tld for subdomains) 
    const certificate = Certificate.fromCertificateArn(
      this,
      `CdkCertificate`,
      process.env.CERTIFICATE_ARN ?? '' // arn:aws:acm:xxxxx..
    );

    // Add HTTPS listener to ALB
    const listener = loadBalancer.addListener("CdkListener", {
      port: 443,
      certificates: [certificate],
    });

    // Connect ALB with ECS Service
    service.registerLoadBalancerTargets({
      containerName: "CdkContainer",
      containerPort: Number(process.env.DOCKER_PORT), // 3000
      newTargetGroupId: "CdkTargetGroup",
      listener: ListenerConfig.applicationListener(listener, {
        protocol: ApplicationProtocol.HTTP,
      }),
    });

    // Get Route53 Hosted Zone
    const zone = HostedZone.fromLookup(this, `CdkZone`, {
      domainName: process.env.DOMAIN ?? '', // domain.tld
    });

    // Create CNAME record
    new CnameRecord(this, `CdkSite`, {
      zone,
      recordName: process.env.ECS_SUBDOMAIN, // ecs.domain.tld
      domainName: loadBalancer.loadBalancerDnsName,
    });

    // Print ALB DNS into terminal
    new CfnOutput(this, `DNS`, { value: loadBalancer.loadBalancerDnsName });
  }
}
