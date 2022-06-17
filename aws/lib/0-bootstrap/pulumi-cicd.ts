import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { Output } from '@pulumi/pulumi'


export class PulumiCICD {
    public readonly secretProviderKeyId!: Output<string>
    public readonly backendBucketName!: Output<string>
    public readonly awsRoleGitHub!: Output<string>


    constructor (private readonly config: pulumi.Config) {
        const secretProviderKeyId = this.setSecretProviderKey(`${this.config.get('organizationName')}/${pulumi.getStack()}/pulumi-secret-provider`).keyId
        const backendBucketName = this.setBackendBucket(`${this.config.get('organizationName')}-${pulumi.getStack()}-pulumi-backend`).bucket
        const awsRoleGitHub = this.setAwsRole(this.setGitHubIdentityProvider())
        this.setAwsRolePolicy(awsRoleGitHub)

        this.secretProviderKeyId = secretProviderKeyId
        this.backendBucketName = backendBucketName
        this.awsRoleGitHub = awsRoleGitHub.arn
    }


    private setSecretProviderKey = (keyName: string): aws.kms.Key =>
        new aws.kms.Key(keyName, {
            description: 'Key for Pulumi secret provider',
            tags: {
                Name: keyName
            }
        })
    
    
    private setBackendBucket = (bucketPrefix: string): aws.s3.Bucket =>
        new aws.s3.Bucket(bucketPrefix, {
            bucketPrefix,
            tags: {
                Name: bucketPrefix
            }
        })


    private setGitHubIdentityProvider = (): aws.iam.OpenIdConnectProvider =>
        new aws.iam.OpenIdConnectProvider('github-oidc', {
            url: 'https://token.actions.githubusercontent.com',
            clientIdLists: [`https://github.com/${this.config.get('githubOrg')}`],
            thumbprintLists: []
        })


    private setAwsRole = (gitHubIdentityProvider: aws.iam.OpenIdConnectProvider): aws.iam.Role =>
        new aws.iam.Role('pulumi-cicd', {
            assumeRolePolicy: aws.iam.getPolicyDocumentOutput({
                statements: [
                    {
                        sid: 'RoleForGitHubActions',
                        principals: [{
                            type: 'Federated',
                            identifiers: [gitHubIdentityProvider.arn]
                        }],
                        actions: ['sts:AssumeRoleWithWebIdentity'],
                        conditions: [
                            {
                                test: 'StringLike',
                                variable: 'token.actions.githubusercontent.com:aud',
                                values: ['sts.amazonaws.com']
                            },
                            {
                                test: 'StringLike',
                                variable: 'token.actions.githubusercontent.com:sub',
                                values: [`repo:${this.config.get('githubOrg')}/${this.config.get('githubRepo')}:*`]
                            }
                        ]
                    }
                ],
            }).json
        })


    private setAwsRolePolicy = (role: aws.iam.Role): aws.iam.RolePolicy =>
        new aws.iam.RolePolicy('pulumi-cicd', {
            role,
            policy: aws.iam.getPolicyDocumentOutput({
                statements: [
                    {
                        actions: [
                            // Basic permissions
                            "iam:*",
                            "s3:*",
                            "ec2:*",
                            // Key Management Service
                            "kms:*",
                            // Required by EKS provider
                            "eks:*",
                            "ssm:*",
                            "autoscaling:*",
                            "cloudformation:*"
                        ],
                        resources: ["*"],
                    }
                ],
            }).json
        })
}
