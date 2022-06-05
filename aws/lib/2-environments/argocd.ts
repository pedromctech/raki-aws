import * as github from '@pulumi/github'
import * as k8s from '@pulumi/kubernetes'
import * as tls from '@pulumi/tls'
import { EksClusterProps } from './eks-cluster'


export class ArgoCD {
    constructor(private readonly props: EksClusterProps, private readonly provider: k8s.Provider) {
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
        new k8s.core.v1.Namespace('argocd', { metadata: { name: 'argocd' } }, { provider: this.provider })


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
        }, { provider: this.provider })


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
                    path: this.props.k8sResourcesPath,
                    repoURL: this.props.infraRepositoryUrl,
                    targetRevision: 'HEAD',
                },
                syncPolicy: {
                    automated: {
                        prune: true,
                        selfHeal: true
                    }
                }
            }
        }, { provider: this.provider, dependsOn: [argoCDHelmChart] })


    // How to configure an SSH repo: https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#repositories
    private configureInfraRepoInArgo = (argoCDHelmChart: k8s.helm.v3.Chart, ns: k8s.core.v1.Namespace, argoSshKey: tls.PrivateKey) =>
        new k8s.core.v1.Secret('argocd-infra-repo-credentials', {
            metadata: {
                name: 'infra-repo-credentials',
                namespace: ns.metadata.name,
                labels: {
                    'argocd.argoproj.io/secret-type': 'repository'
                }
            },
            stringData: {
                type: 'git',
                url: this.props.infraRepositoryUrl,
                sshPrivateKey: argoSshKey.privateKeyOpenssh
            }
        }, { provider: this.provider, dependsOn: [argoCDHelmChart] })


    private addArgoDeployKeyToInfraRepo = (argoSshKey: tls.PrivateKey) =>
        new github.RepositoryDeployKey('argocd', {
            title: `ArgoCD Main App (${this.props.environment})`,
            repository: this.props.infraRepositoryName,
            key: argoSshKey.publicKeyOpenssh,
            readOnly: true
        })
}
