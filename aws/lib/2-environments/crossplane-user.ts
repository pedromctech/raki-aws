import * as aws from '@pulumi/aws'
import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'


export interface CrossplaneUserProps {
    environment: string
    provider: k8s.Provider
    dependencies: pulumi.Resource[]
}


export class CrossplaneUser {
    constructor(private readonly props: CrossplaneUserProps) {
        const awsUser = this.setAwsUser()
        this.setAwsUserPolicy(awsUser)
        this.setAccessKeyK8sSecret(this.setAwsAccessKey(awsUser))
    }


    private setAwsUser = (): aws.iam.User =>
        new aws.iam.User('crossplane', {
            name: `${this.props.environment}-crossplane`
        })


    private setAwsUserPolicy = (user: aws.iam.User): aws.iam.UserPolicy =>
        new aws.iam.UserPolicy('crossplane', {
            user: user.name,
            policy: aws.iam.getPolicyDocumentOutput({
                statements: [
                    {
                        // Define here permissions and resources for Crossplane
                        actions: [
                            's3:*'
                        ],
                        resources: [
                            `arn:aws:s3:::${this.props.environment}-*`,
                        ]
                    }
                ],
            }).json
        })


    private setAwsAccessKey = (user: aws.iam.User): aws.iam.AccessKey =>
        new aws.iam.AccessKey('crossplane', { user: user.id })


    private setAccessKeyK8sSecret = (accessKey: aws.iam.AccessKey): k8s.core.v1.Secret =>
        new k8s.core.v1.Secret('crossplane-aws-credentials', {
            metadata: {
                name: 'crossplane-aws-credentials',
                namespace: 'default'
            },
            stringData: {
                creds: pulumi.interpolate`[default]\naws_access_key_id = ${accessKey.id}\naws_secret_access_key = ${accessKey.secret}`
            }
        }, { provider: this.props.provider, dependsOn: this.props.dependencies })
}
