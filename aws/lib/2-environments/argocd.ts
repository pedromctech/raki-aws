import * as github from '@pulumi/github'
import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import * as tls from '@pulumi/tls'


export interface ArgoCDProps {
    config: pulumi.Config
    environment: string
    provider: k8s.Provider
    dependencies: pulumi.Resource[]
}


export class ArgoCD {
    constructor(private readonly props: ArgoCDProps) {
        // Deploy ArgoCD
        const namespace = this.setArgoNamespace()
        const helmChart = this.setArgoCDHelmChart(namespace)

        // Allow ArgoCD to read GitHub repo
        const sshKey = new tls.PrivateKey('argocd-infra-repo', { algorithm: 'ECDSA', ecdsaCurve: 'P521' })
        this.configureInfraRepoInArgo(helmChart, namespace, sshKey)
        this.addArgoDeployKeyToInfraRepo(sshKey)

        // Set Main App
        this.setMainApp(helmChart, namespace)
    }


    private setArgoNamespace = (): k8s.core.v1.Namespace =>
        new k8s.core.v1.Namespace(
            'argocd',
            { metadata: { name: 'argocd' } },
            { provider: this.props.provider, dependsOn: this.props.dependencies }
        )


    private setArgoCDHelmChart = (ns: k8s.core.v1.Namespace): k8s.helm.v3.Chart =>
        new k8s.helm.v3.Chart('argocd', {
            fetchOpts: { repo: 'https://argoproj.github.io/argo-helm' },
            chart: 'argo-cd',
            version: '4.6.0',
            namespace: ns.metadata.name,
            values: {
                controller: {
                    enableStatefulSet: false
                },
                dex: { enabled: false }
            }
        }, { provider: this.props.provider, dependsOn: [ns] })


    // App of Apps pattern: https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#app-of-apps
    // Tool auto-detection: https://argo-cd.readthedocs.io/en/stable/user-guide/tool_detection/#tool-detection
    private setMainApp = (argoCDHelmChart: k8s.helm.v3.Chart, ns: k8s.core.v1.Namespace): k8s.apiextensions.CustomResource =>
        new k8s.apiextensions.CustomResource('argoproj-application-main-app', {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: {
                namespace: ns.metadata.name,
                name: 'main-app',
            },
            spec: {
                destination: {
                    namespace: ns.metadata.name,
                    server: 'https://kubernetes.default.svc'
                },
                project: 'default',
                source: {
                    path: this.props.config.get('k8sResourcesPath'),
                    repoURL: this.props.config.get('infraRepositoryUrl'),
                    targetRevision: 'HEAD',
                },
                syncPolicy: {
                    automated: {
                        prune: true,
                        selfHeal: true
                    }
                }
            }
        }, { provider: this.props.provider, dependsOn: [argoCDHelmChart] })


    // How to configure an SSH repo: https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#repositories
    private configureInfraRepoInArgo = (argoCDHelmChart: k8s.helm.v3.Chart, ns: k8s.core.v1.Namespace, argoSshKey: tls.PrivateKey) =>
        new k8s.core.v1.Secret('argocd-infra-repo-credentials', {
            metadata: {
                name: 'argocd-infra-repo-credentials',
                namespace: ns.metadata.name,
                labels: {
                    'argocd.argoproj.io/secret-type': 'repository'
                }
            },
            stringData: {
                type: 'git',
                url: this.props.config.get('infraRepositoryUrl') ?? '',
                sshPrivateKey: argoSshKey.privateKeyOpenssh
            }
        }, { provider: this.props.provider, dependsOn: [argoCDHelmChart] })


    private addArgoDeployKeyToInfraRepo = (argoSshKey: tls.PrivateKey) =>
        new github.RepositoryDeployKey('argocd', {
            title: `ArgoCD Main App (${this.props.environment})`,
            repository: this.props.config.get('infraRepositoryName') ?? '',
            key: argoSshKey.publicKeyOpenssh,
            readOnly: true
        })
}
