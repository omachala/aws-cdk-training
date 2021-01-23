# AWS CDK Stacks
## Fargate Stack
- ECS fargate
- simple dockerized nodeJS server
- Aplication Load Balancer
- ECS scaling
- HTTPS ALB redirect
- custom (sub)domain Route53

`yarn cdk deploy FargateStack`

## ApiGateway Stack
- Api Gateway
- SQS
- AWS Integration AG -> SQS
- custom (sub)domain Route53

`yarn cdk deploy ApiGatewayStack`

### Useful commands

 * `yarn run build`     compile typescript to js
 * `yarn run watch`     watch for changes and compile
 * `yarn run test`      perform the jest unit tests
 * `cdk deploy`         deploy this stack to your default AWS account/region
 * `cdk diff`           compare deployed stack with current state
 * `cdk synth`          emits the synthesized CloudFormation template
