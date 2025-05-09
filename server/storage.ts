import { 
  users, 
  User, 
  InsertUser, 
  OverviewStatsData, 
  ClusterData,
  ServiceHealthData,
  EventData,
  WorkloadData,
  ClusterMetrics,
  clusters,
  namespaces,
  InsertNamespace,
  Namespace,
  NamespaceData,
  clusterDependencies,
  InsertClusterDependency,
  ClusterDependency,
  ClusterDependencyData,
  networkIngressControllers,
  NetworkIngressControllerData,
  networkLoadBalancers,
  NetworkLoadBalancerData,
  networkRoutes,
  NetworkRouteData,
  networkPolicies,
  NetworkPolicyData
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage methods
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Dashboard data methods
  getOverviewStats(): Promise<OverviewStatsData>;
  getClusters(): Promise<ClusterData[]>;
  getClusterById(id: string): Promise<ClusterData | undefined>;
  getServiceHealth(): Promise<ServiceHealthData[]>;
  getRecentEvents(): Promise<EventData[]>;
  getWorkloadStatus(): Promise<WorkloadData>;
  
  // Namespace methods
  getNamespaces(): Promise<NamespaceData[]>;
  getNamespacesByCluster(clusterId: string): Promise<NamespaceData[]>;
  getNamespaceById(id: number): Promise<NamespaceData | undefined>;
  createNamespace(namespace: InsertNamespace): Promise<Namespace>;
  
  // Cluster Dependency methods
  getClusterDependencies(): Promise<ClusterDependencyData[]>;
  getClusterDependenciesByType(type: string): Promise<ClusterDependencyData[]>; 
  getClusterDependenciesByCluster(clusterId: string): Promise<ClusterDependencyData[]>;
  getClusterDependencyById(id: number): Promise<ClusterDependencyData | undefined>;
  createClusterDependency(dependency: InsertClusterDependency): Promise<ClusterDependency>;
  deleteClusterDependenciesByCluster(clusterId: string): Promise<void>;
  
  // Network Ingress Controller methods
  getNetworkIngressControllers(): Promise<NetworkIngressControllerData[]>;
  getNetworkIngressControllersByCluster(clusterId: string): Promise<NetworkIngressControllerData[]>;
  getNetworkIngressControllerById(id: number): Promise<NetworkIngressControllerData | undefined>;
  
  // Network Load Balancer methods
  getNetworkLoadBalancers(): Promise<NetworkLoadBalancerData[]>;
  getNetworkLoadBalancersByCluster(clusterId: string): Promise<NetworkLoadBalancerData[]>;
  getNetworkLoadBalancerById(id: number): Promise<NetworkLoadBalancerData | undefined>;
  
  // Network Route methods
  getNetworkRoutes(): Promise<NetworkRouteData[]>;
  getNetworkRoutesByCluster(clusterId: string): Promise<NetworkRouteData[]>;
  getNetworkRouteById(id: number): Promise<NetworkRouteData | undefined>;
  
  // Network Policy methods
  getNetworkPolicies(): Promise<NetworkPolicyData[]>;
  getNetworkPoliciesByCluster(clusterId: string): Promise<NetworkPolicyData[]>;
  getNetworkPolicyById(id: number): Promise<NetworkPolicyData | undefined>;
}

// Database implementation of storage
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Dashboard data methods
  async getOverviewStats(): Promise<OverviewStatsData> {
    // Calculate stats based on cluster data in the database
    const clusterData = await this.getClusters();
    
    const gkeClusters = clusterData.filter(c => c.provider === 'GKE').length;
    const aksClusters = clusterData.filter(c => c.provider === 'AKS').length;
    const eksClusters = clusterData.filter(c => c.provider === 'EKS').length;
    
    let totalNodes = 0;
    let totalPods = 0;
    let runningPods = 0;
    let totalNamespaces = 0;
    
    for (const cluster of clusterData) {
      totalNodes += cluster.nodesTotal;
      totalPods += cluster.podsTotal;
      runningPods += cluster.podsRunning;
      totalNamespaces += cluster.namespaces;
    }
    
    return {
      totalClusters: clusterData.length,
      clustersChange: 0, // Would need historical data to calculate change
      gkeClusters,
      aksClusters,
      eksClusters,
      
      totalNodes,
      nodesChange: 0,
      
      totalPods,
      podsChange: 0,
      runningPods,
      pendingPods: totalPods - runningPods, // Simplified
      failedPods: 0, // Would need more detailed data
      
      totalNamespaces,
      namespacesChange: 0,
      systemNamespaces: Math.round(totalNamespaces * 0.3), // Approximation
      userNamespaces: Math.round(totalNamespaces * 0.7) // Approximation
    };
  }

  async getClusters(): Promise<ClusterData[]> {
    try {
      const dbClusters = await db.select().from(clusters);
      
      // Convert DB clusters to ClusterData format
      return dbClusters.map(cluster => {
        const metadata = cluster.metadata as any || {}; // Type assertion for metadata
        return {
          id: cluster.clusterId as string,
          name: cluster.name,
          provider: cluster.provider,
          version: cluster.version,
          versionStatus: cluster.versionStatus,
          region: cluster.region,
          status: cluster.status,
          nodesTotal: cluster.nodesTotal,
          nodesReady: cluster.nodesReady,
          podsTotal: cluster.podsTotal,
          podsRunning: cluster.podsRunning,
          namespaces: cluster.namespaces,
          services: cluster.services,
          deployments: cluster.deployments,
          ingresses: cluster.ingresses,
          createdAt: cluster.createdAt ? new Date(cluster.createdAt).toISOString() : new Date().toISOString(),
          // Handle the metadata JSON field which can contain events and nodes
          events: metadata.events || [],
          nodes: metadata.nodes || []
        };
      });
    } catch (error) {
      console.error("Error fetching clusters from database:", error);
      
      // If no data exists yet, return empty array
      return [];
    }
  }

  async getClusterById(id: string): Promise<ClusterData | undefined> {
    try {
      const [cluster] = await db.select().from(clusters).where(eq(clusters.clusterId, id));
      
      if (!cluster) return undefined;
      
      const metadata = cluster.metadata as any || {}; // Type assertion for metadata
      
      return {
        id: cluster.clusterId as string,
        name: cluster.name,
        provider: cluster.provider,
        version: cluster.version,
        versionStatus: cluster.versionStatus,
        region: cluster.region,
        status: cluster.status,
        nodesTotal: cluster.nodesTotal,
        nodesReady: cluster.nodesReady,
        podsTotal: cluster.podsTotal,
        podsRunning: cluster.podsRunning,
        namespaces: cluster.namespaces,
        services: cluster.services,
        deployments: cluster.deployments,
        ingresses: cluster.ingresses,
        createdAt: cluster.createdAt ? new Date(cluster.createdAt).toISOString() : new Date().toISOString(),
        events: metadata.events || [],
        nodes: metadata.nodes || []
      };
    } catch (error) {
      console.error(`Error fetching cluster with ID ${id} from database:`, error);
      return undefined;
    }
  }

  async getServiceHealth(): Promise<ServiceHealthData[]> {
    // For now, return static data as this would typically come from a service mesh or monitoring system
    return [
      {
        name: "Istio Service Mesh",
        status: "Healthy",
        description: "4 Clusters, 24 Namespaces",
        metrics: [
          { label: "Success Rate", value: "99.8%" },
          { label: "Avg. Latency", value: "28ms" }
        ]
      },
      {
        name: "Ingress Controllers",
        status: "Healthy",
        description: "12 Controllers, 36 Rules",
        metrics: [
          { label: "Success Rate", value: "99.9%" },
          { label: "Throughput", value: "3.2K req/s" }
        ]
      },
      {
        name: "Service Discovery",
        status: "Warning",
        description: "76 Services, 156 Endpoints",
        metrics: [
          { label: "Healthy", value: "98.2%" },
          { label: "Issues", value: "2", highlightValue: "warning" }
        ]
      },
      {
        name: "Persistent Volumes",
        status: "Healthy",
        description: "128 Volumes, 4.2TB Total",
        metrics: [
          { label: "Usage", value: "62%" },
          { label: "Bound", value: "118/128" }
        ]
      }
    ];
  }

  async getRecentEvents(): Promise<EventData[]> {
    // For now, return static event data
    // In a real implementation, this might come from a dedicated events table
    return [
      {
        type: "success",
        title: "Cluster Autoscaling Completed",
        time: "10m ago",
        description: "gke-prod-cluster1 scaled from 10 to 12 nodes based on resource demand."
      },
      {
        type: "warning",
        title: "High Memory Usage Alert",
        time: "25m ago",
        description: "aks-prod-eastus:database namespace has pods with memory usage >85%."
      },
      {
        type: "error",
        title: "Node Failure Detected",
        time: "48m ago",
        description: "aks-dev-westeu node 'aks-nodepool1-12345-vmss000003' is not responding."
      },
      {
        type: "info",
        title: "Update Available",
        time: "1h ago",
        description: "Kubernetes v1.26.5 is available for gke-stage-cluster1 (currently on v1.25.8)."
      }
    ];
  }

  async getWorkloadStatus(): Promise<WorkloadData> {
    // For now, return static workload data
    return {
      summary: {
        deployments: [
          { clusterType: "GKE", total: 56, healthy: 54, warning: 2, failed: 0 },
          { clusterType: "AKS", total: 30, healthy: 28, warning: 1, failed: 1 },
          { clusterType: "EKS", total: 42, healthy: 40, warning: 2, failed: 0 }
        ],
        statefulSets: [
          { clusterType: "GKE", total: 16, healthy: 15, warning: 1, failed: 0 },
          { clusterType: "AKS", total: 8, healthy: 7, warning: 1, failed: 0 },
          { clusterType: "EKS", total: 12, healthy: 11, warning: 1, failed: 0 }
        ]
      },
      distribution: {
        daemonSets: {
          GKE: 24,
          AKS: 16,
          EKS: 12
        }
      },
      topConsumers: [
        {
          id: "api-gateway",
          name: "api-gateway",
          cluster: "gke-prod-cluster1",
          resources: {
            cpu: "4.2 cores",
            memory: "8.1 GB"
          }
        },
        {
          id: "elasticsearch",
          name: "elasticsearch",
          cluster: "gke-prod-cluster1",
          resources: {
            cpu: "3.8 cores",
            memory: "12.4 GB"
          }
        },
        {
          id: "postgres-master",
          name: "postgres-master",
          cluster: "aks-prod-eastus",
          resources: {
            cpu: "2.5 cores",
            memory: "6.8 GB"
          }
        }
      ]
    };
  }
  
  // Namespace methods
  async getNamespaces(): Promise<NamespaceData[]> {
    try {
      // Join namespaces and clusters to get cluster names
      const result = await db.select({
        id: namespaces.id,
        clusterId: namespaces.clusterId,
        clusterName: clusters.name,
        name: namespaces.name,
        status: namespaces.status,
        age: namespaces.age,
        phase: namespaces.phase,
        labels: namespaces.labels,
        annotations: namespaces.annotations,
        podCount: namespaces.podCount,
        resourceQuota: namespaces.resourceQuota,
        createdAt: namespaces.createdAt
      })
      .from(namespaces)
      .innerJoin(clusters, eq(namespaces.clusterId, clusters.clusterId));
      
      return result.map(ns => ({
        id: ns.id,
        clusterId: ns.clusterId,
        clusterName: ns.clusterName,
        name: ns.name,
        status: ns.status,
        age: ns.age,
        phase: ns.phase,
        labels: ns.labels as Record<string, string> || {},
        annotations: ns.annotations as Record<string, string> || {},
        podCount: ns.podCount ?? 0, // Use nullish coalescing to ensure it's a number
        resourceQuota: ns.resourceQuota ?? false, // Use nullish coalescing to ensure it's a boolean
        createdAt: ns.createdAt ? new Date(ns.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (error) {
      console.error("Error fetching namespaces from database:", error);
      return [];
    }
  }

  async getNamespacesByCluster(clusterId: string): Promise<NamespaceData[]> {
    try {
      const result = await db.select({
        id: namespaces.id,
        clusterId: namespaces.clusterId,
        clusterName: clusters.name,
        name: namespaces.name,
        status: namespaces.status,
        age: namespaces.age,
        phase: namespaces.phase,
        labels: namespaces.labels,
        annotations: namespaces.annotations,
        podCount: namespaces.podCount,
        resourceQuota: namespaces.resourceQuota,
        createdAt: namespaces.createdAt
      })
      .from(namespaces)
      .innerJoin(clusters, eq(namespaces.clusterId, clusters.clusterId))
      .where(eq(namespaces.clusterId, clusterId));
      
      return result.map(ns => ({
        id: ns.id,
        clusterId: ns.clusterId,
        clusterName: ns.clusterName,
        name: ns.name,
        status: ns.status,
        age: ns.age,
        phase: ns.phase,
        labels: ns.labels as Record<string, string> || {},
        annotations: ns.annotations as Record<string, string> || {},
        podCount: ns.podCount ?? 0,
        resourceQuota: ns.resourceQuota ?? false,
        createdAt: ns.createdAt ? new Date(ns.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Error fetching namespaces for cluster ${clusterId} from database:`, error);
      return [];
    }
  }

  async getNamespaceById(id: number): Promise<NamespaceData | undefined> {
    try {
      const [result] = await db.select({
        id: namespaces.id,
        clusterId: namespaces.clusterId,
        clusterName: clusters.name,
        name: namespaces.name,
        status: namespaces.status,
        age: namespaces.age,
        phase: namespaces.phase,
        labels: namespaces.labels,
        annotations: namespaces.annotations,
        podCount: namespaces.podCount,
        resourceQuota: namespaces.resourceQuota,
        createdAt: namespaces.createdAt
      })
      .from(namespaces)
      .innerJoin(clusters, eq(namespaces.clusterId, clusters.clusterId))
      .where(eq(namespaces.id, id));
      
      if (!result) return undefined;
      
      return {
        id: result.id,
        clusterId: result.clusterId,
        clusterName: result.clusterName,
        name: result.name,
        status: result.status,
        age: result.age,
        phase: result.phase,
        labels: result.labels as Record<string, string> || {},
        annotations: result.annotations as Record<string, string> || {},
        podCount: result.podCount ?? 0,
        resourceQuota: result.resourceQuota ?? false,
        createdAt: result.createdAt ? new Date(result.createdAt).toISOString() : new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error fetching namespace with ID ${id} from database:`, error);
      return undefined;
    }
  }

  async createNamespace(ns: InsertNamespace): Promise<Namespace> {
    try {
      const [namespace] = await db.insert(namespaces).values(ns).returning();
      return namespace;
    } catch (error) {
      console.error("Error creating namespace in database:", error);
      throw error;
    }
  }
  
  // Cluster Dependency methods
  async getClusterDependencies(): Promise<ClusterDependencyData[]> {
    try {
      const result = await db.select({
        id: clusterDependencies.id,
        clusterId: clusterDependencies.clusterId,
        type: clusterDependencies.type,
        name: clusterDependencies.name,
        namespace: clusterDependencies.namespace,
        version: clusterDependencies.version,
        status: clusterDependencies.status,
        detectedAt: clusterDependencies.detectedAt,
        metadata: clusterDependencies.metadata
      })
      .from(clusterDependencies)
      .innerJoin(clusters, eq(clusterDependencies.clusterId, clusters.clusterId));
      
      return result.map(dep => ({
        id: dep.id,
        clusterId: dep.clusterId,
        type: dep.type,
        name: dep.name,
        namespace: dep.namespace,
        version: dep.version || undefined,
        status: dep.status,
        detectedAt: dep.detectedAt ? new Date(dep.detectedAt).toISOString() : new Date().toISOString(),
        metadata: dep.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error("Error fetching cluster dependencies from database:", error);
      return [];
    }
  }
  
  async getClusterDependenciesByType(type: string): Promise<ClusterDependencyData[]> {
    try {
      const result = await db.select({
        id: clusterDependencies.id,
        clusterId: clusterDependencies.clusterId,
        type: clusterDependencies.type,
        name: clusterDependencies.name,
        namespace: clusterDependencies.namespace,
        version: clusterDependencies.version,
        status: clusterDependencies.status,
        detectedAt: clusterDependencies.detectedAt,
        metadata: clusterDependencies.metadata
      })
      .from(clusterDependencies)
      .where(eq(clusterDependencies.type, type));
      
      return result.map(dep => ({
        id: dep.id,
        clusterId: dep.clusterId,
        type: dep.type,
        name: dep.name,
        namespace: dep.namespace,
        version: dep.version || undefined,
        status: dep.status,
        detectedAt: dep.detectedAt ? new Date(dep.detectedAt).toISOString() : new Date().toISOString(),
        metadata: dep.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error(`Error fetching cluster dependencies of type ${type} from database:`, error);
      return [];
    }
  }
  
  async getClusterDependenciesByCluster(clusterId: string): Promise<ClusterDependencyData[]> {
    try {
      const result = await db.select({
        id: clusterDependencies.id,
        clusterId: clusterDependencies.clusterId,
        type: clusterDependencies.type,
        name: clusterDependencies.name,
        namespace: clusterDependencies.namespace,
        version: clusterDependencies.version,
        status: clusterDependencies.status,
        detectedAt: clusterDependencies.detectedAt,
        metadata: clusterDependencies.metadata
      })
      .from(clusterDependencies)
      .where(eq(clusterDependencies.clusterId, clusterId));
      
      return result.map(dep => ({
        id: dep.id,
        clusterId: dep.clusterId,
        type: dep.type,
        name: dep.name,
        namespace: dep.namespace,
        version: dep.version || undefined,
        status: dep.status,
        detectedAt: dep.detectedAt ? new Date(dep.detectedAt).toISOString() : new Date().toISOString(),
        metadata: dep.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error(`Error fetching dependencies for cluster ${clusterId} from database:`, error);
      return [];
    }
  }
  
  async getClusterDependencyById(id: number): Promise<ClusterDependencyData | undefined> {
    try {
      const [dependency] = await db.select({
        id: clusterDependencies.id,
        clusterId: clusterDependencies.clusterId,
        type: clusterDependencies.type,
        name: clusterDependencies.name,
        namespace: clusterDependencies.namespace,
        version: clusterDependencies.version,
        status: clusterDependencies.status,
        detectedAt: clusterDependencies.detectedAt,
        metadata: clusterDependencies.metadata
      })
      .from(clusterDependencies)
      .where(eq(clusterDependencies.id, id));
      
      if (!dependency) return undefined;
      
      return {
        id: dependency.id,
        clusterId: dependency.clusterId,
        type: dependency.type,
        name: dependency.name,
        namespace: dependency.namespace,
        version: dependency.version || undefined,
        status: dependency.status,
        detectedAt: dependency.detectedAt ? new Date(dependency.detectedAt).toISOString() : new Date().toISOString(),
        metadata: dependency.metadata as Record<string, any> || {}
      };
    } catch (error) {
      console.error(`Error fetching dependency with ID ${id} from database:`, error);
      return undefined;
    }
  }
  
  async createClusterDependency(dependency: InsertClusterDependency): Promise<ClusterDependency> {
    try {
      const [newDependency] = await db
        .insert(clusterDependencies)
        .values(dependency)
        .returning();
      return newDependency;
    } catch (error) {
      console.error(`Error creating cluster dependency ${dependency.name}:`, error);
      throw error;
    }
  }
  
  async deleteClusterDependenciesByCluster(clusterId: string): Promise<void> {
    try {
      await db
        .delete(clusterDependencies)
        .where(eq(clusterDependencies.clusterId, clusterId));
    } catch (error) {
      console.error(`Error deleting dependencies for cluster ${clusterId}:`, error);
      throw error;
    }
  }
  
  // Network Ingress Controller methods
  async getNetworkIngressControllers(): Promise<NetworkIngressControllerData[]> {
    try {
      // Join with clusters to get cluster names
      const result = await db.select({
        id: networkIngressControllers.id,
        clusterId: networkIngressControllers.clusterId,
        name: networkIngressControllers.name,
        namespace: networkIngressControllers.namespace,
        type: networkIngressControllers.type,
        status: networkIngressControllers.status,
        version: networkIngressControllers.version,
        ipAddress: networkIngressControllers.ipAddress,
        trafficHandled: networkIngressControllers.trafficHandled,
        detectedAt: networkIngressControllers.detectedAt,
        metadata: networkIngressControllers.metadata
      })
      .from(networkIngressControllers);
      
      return result.map(controller => ({
        id: controller.id,
        clusterId: controller.clusterId,
        name: controller.name,
        namespace: controller.namespace,
        type: controller.type,
        status: controller.status,
        version: controller.version,
        ipAddress: controller.ipAddress,
        trafficHandled: controller.trafficHandled,
        detectedAt: new Date(controller.detectedAt).toISOString(),
        metadata: controller.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error("Error fetching network ingress controllers from database:", error);
      return [];
    }
  }
  
  async getNetworkIngressControllersByCluster(clusterId: string): Promise<NetworkIngressControllerData[]> {
    try {
      const result = await db.select({
        id: networkIngressControllers.id,
        clusterId: networkIngressControllers.clusterId,
        name: networkIngressControllers.name,
        namespace: networkIngressControllers.namespace,
        type: networkIngressControllers.type,
        status: networkIngressControllers.status,
        version: networkIngressControllers.version,
        ipAddress: networkIngressControllers.ipAddress,
        trafficHandled: networkIngressControllers.trafficHandled,
        detectedAt: networkIngressControllers.detectedAt,
        metadata: networkIngressControllers.metadata
      })
      .from(networkIngressControllers)
      .where(eq(networkIngressControllers.clusterId, clusterId));
      
      return result.map(controller => ({
        id: controller.id,
        clusterId: controller.clusterId,
        name: controller.name,
        namespace: controller.namespace,
        type: controller.type,
        status: controller.status,
        version: controller.version,
        ipAddress: controller.ipAddress,
        trafficHandled: controller.trafficHandled,
        detectedAt: new Date(controller.detectedAt).toISOString(),
        metadata: controller.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error(`Error fetching network ingress controllers for cluster ${clusterId} from database:`, error);
      return [];
    }
  }
  
  async getNetworkIngressControllerById(id: number): Promise<NetworkIngressControllerData | undefined> {
    try {
      const [controller] = await db.select({
        id: networkIngressControllers.id,
        clusterId: networkIngressControllers.clusterId,
        name: networkIngressControllers.name,
        namespace: networkIngressControllers.namespace,
        type: networkIngressControllers.type,
        status: networkIngressControllers.status,
        version: networkIngressControllers.version,
        ipAddress: networkIngressControllers.ipAddress,
        trafficHandled: networkIngressControllers.trafficHandled,
        detectedAt: networkIngressControllers.detectedAt,
        metadata: networkIngressControllers.metadata
      })
      .from(networkIngressControllers)
      .where(eq(networkIngressControllers.id, id));
      
      if (!controller) return undefined;
      
      return {
        id: controller.id,
        clusterId: controller.clusterId,
        name: controller.name,
        namespace: controller.namespace,
        type: controller.type,
        status: controller.status,
        version: controller.version,
        ipAddress: controller.ipAddress,
        trafficHandled: controller.trafficHandled,
        detectedAt: new Date(controller.detectedAt).toISOString(),
        metadata: controller.metadata as Record<string, any> || {}
      };
    } catch (error) {
      console.error(`Error fetching network ingress controller with ID ${id} from database:`, error);
      return undefined;
    }
  }
  
  // Network Load Balancer methods
  async getNetworkLoadBalancers(): Promise<NetworkLoadBalancerData[]> {
    try {
      const result = await db.select({
        id: networkLoadBalancers.id,
        clusterId: networkLoadBalancers.clusterId,
        name: networkLoadBalancers.name,
        namespace: networkLoadBalancers.namespace,
        type: networkLoadBalancers.type,
        status: networkLoadBalancers.status,
        ipAddresses: networkLoadBalancers.ipAddresses,
        trafficHandled: networkLoadBalancers.trafficHandled,
        detectedAt: networkLoadBalancers.detectedAt,
        metadata: networkLoadBalancers.metadata
      })
      .from(networkLoadBalancers);
      
      return result.map(lb => ({
        id: lb.id,
        clusterId: lb.clusterId,
        name: lb.name,
        namespace: lb.namespace,
        type: lb.type,
        status: lb.status,
        ipAddresses: lb.ipAddresses,
        trafficHandled: lb.trafficHandled,
        detectedAt: new Date(lb.detectedAt).toISOString(),
        metadata: lb.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error("Error fetching network load balancers from database:", error);
      return [];
    }
  }
  
  async getNetworkLoadBalancersByCluster(clusterId: string): Promise<NetworkLoadBalancerData[]> {
    try {
      const result = await db.select({
        id: networkLoadBalancers.id,
        clusterId: networkLoadBalancers.clusterId,
        name: networkLoadBalancers.name,
        namespace: networkLoadBalancers.namespace,
        type: networkLoadBalancers.type,
        status: networkLoadBalancers.status,
        ipAddresses: networkLoadBalancers.ipAddresses,
        trafficHandled: networkLoadBalancers.trafficHandled,
        detectedAt: networkLoadBalancers.detectedAt,
        metadata: networkLoadBalancers.metadata
      })
      .from(networkLoadBalancers)
      .where(eq(networkLoadBalancers.clusterId, clusterId));
      
      return result.map(lb => ({
        id: lb.id,
        clusterId: lb.clusterId,
        name: lb.name,
        namespace: lb.namespace,
        type: lb.type,
        status: lb.status,
        ipAddresses: lb.ipAddresses,
        trafficHandled: lb.trafficHandled,
        detectedAt: new Date(lb.detectedAt).toISOString(),
        metadata: lb.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error(`Error fetching network load balancers for cluster ${clusterId} from database:`, error);
      return [];
    }
  }
  
  async getNetworkLoadBalancerById(id: number): Promise<NetworkLoadBalancerData | undefined> {
    try {
      const [lb] = await db.select({
        id: networkLoadBalancers.id,
        clusterId: networkLoadBalancers.clusterId,
        name: networkLoadBalancers.name,
        namespace: networkLoadBalancers.namespace,
        type: networkLoadBalancers.type,
        status: networkLoadBalancers.status,
        ipAddresses: networkLoadBalancers.ipAddresses,
        trafficHandled: networkLoadBalancers.trafficHandled,
        detectedAt: networkLoadBalancers.detectedAt,
        metadata: networkLoadBalancers.metadata
      })
      .from(networkLoadBalancers)
      .where(eq(networkLoadBalancers.id, id));
      
      if (!lb) return undefined;
      
      return {
        id: lb.id,
        clusterId: lb.clusterId,
        name: lb.name,
        namespace: lb.namespace,
        type: lb.type,
        status: lb.status,
        ipAddresses: lb.ipAddresses,
        trafficHandled: lb.trafficHandled,
        detectedAt: new Date(lb.detectedAt).toISOString(),
        metadata: lb.metadata as Record<string, any> || {}
      };
    } catch (error) {
      console.error(`Error fetching network load balancer with ID ${id} from database:`, error);
      return undefined;
    }
  }
  
  // Network Route methods
  async getNetworkRoutes(): Promise<NetworkRouteData[]> {
    try {
      const result = await db.select({
        id: networkRoutes.id,
        clusterId: networkRoutes.clusterId,
        name: networkRoutes.name,
        source: networkRoutes.source,
        destination: networkRoutes.destination,
        protocol: networkRoutes.protocol,
        status: networkRoutes.status,
        detectedAt: networkRoutes.detectedAt,
        metadata: networkRoutes.metadata
      })
      .from(networkRoutes);
      
      return result.map(route => ({
        id: route.id,
        clusterId: route.clusterId,
        name: route.name,
        source: route.source,
        destination: route.destination,
        protocol: route.protocol,
        status: route.status,
        detectedAt: new Date(route.detectedAt).toISOString(),
        metadata: route.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error("Error fetching network routes from database:", error);
      return [];
    }
  }
  
  async getNetworkRoutesByCluster(clusterId: string): Promise<NetworkRouteData[]> {
    try {
      const result = await db.select({
        id: networkRoutes.id,
        clusterId: networkRoutes.clusterId,
        name: networkRoutes.name,
        source: networkRoutes.source,
        destination: networkRoutes.destination,
        protocol: networkRoutes.protocol,
        status: networkRoutes.status,
        detectedAt: networkRoutes.detectedAt,
        metadata: networkRoutes.metadata
      })
      .from(networkRoutes)
      .where(eq(networkRoutes.clusterId, clusterId));
      
      return result.map(route => ({
        id: route.id,
        clusterId: route.clusterId,
        name: route.name,
        source: route.source,
        destination: route.destination,
        protocol: route.protocol,
        status: route.status,
        detectedAt: new Date(route.detectedAt).toISOString(),
        metadata: route.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error(`Error fetching network routes for cluster ${clusterId} from database:`, error);
      return [];
    }
  }
  
  async getNetworkRouteById(id: number): Promise<NetworkRouteData | undefined> {
    try {
      const [route] = await db.select({
        id: networkRoutes.id,
        clusterId: networkRoutes.clusterId,
        name: networkRoutes.name,
        source: networkRoutes.source,
        destination: networkRoutes.destination,
        protocol: networkRoutes.protocol,
        status: networkRoutes.status,
        detectedAt: networkRoutes.detectedAt,
        metadata: networkRoutes.metadata
      })
      .from(networkRoutes)
      .where(eq(networkRoutes.id, id));
      
      if (!route) return undefined;
      
      return {
        id: route.id,
        clusterId: route.clusterId,
        name: route.name,
        source: route.source,
        destination: route.destination,
        protocol: route.protocol,
        status: route.status,
        detectedAt: new Date(route.detectedAt).toISOString(),
        metadata: route.metadata as Record<string, any> || {}
      };
    } catch (error) {
      console.error(`Error fetching network route with ID ${id} from database:`, error);
      return undefined;
    }
  }
  
  // Network Policy methods
  async getNetworkPolicies(): Promise<NetworkPolicyData[]> {
    try {
      const result = await db.select({
        id: networkPolicies.id,
        clusterId: networkPolicies.clusterId,
        name: networkPolicies.name,
        namespace: networkPolicies.namespace,
        type: networkPolicies.type,
        direction: networkPolicies.direction,
        status: networkPolicies.status,
        detectedAt: networkPolicies.detectedAt,
        metadata: networkPolicies.metadata
      })
      .from(networkPolicies);
      
      return result.map(policy => ({
        id: policy.id,
        clusterId: policy.clusterId,
        name: policy.name,
        namespace: policy.namespace,
        type: policy.type,
        direction: policy.direction,
        status: policy.status,
        detectedAt: new Date(policy.detectedAt).toISOString(),
        metadata: policy.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error("Error fetching network policies from database:", error);
      return [];
    }
  }
  
  async getNetworkPoliciesByCluster(clusterId: string): Promise<NetworkPolicyData[]> {
    try {
      const result = await db.select({
        id: networkPolicies.id,
        clusterId: networkPolicies.clusterId,
        name: networkPolicies.name,
        namespace: networkPolicies.namespace,
        type: networkPolicies.type,
        direction: networkPolicies.direction,
        status: networkPolicies.status,
        detectedAt: networkPolicies.detectedAt,
        metadata: networkPolicies.metadata
      })
      .from(networkPolicies)
      .where(eq(networkPolicies.clusterId, clusterId));
      
      return result.map(policy => ({
        id: policy.id,
        clusterId: policy.clusterId,
        name: policy.name,
        namespace: policy.namespace,
        type: policy.type,
        direction: policy.direction,
        status: policy.status,
        detectedAt: new Date(policy.detectedAt).toISOString(),
        metadata: policy.metadata as Record<string, any> || {}
      }));
    } catch (error) {
      console.error(`Error fetching network policies for cluster ${clusterId} from database:`, error);
      return [];
    }
  }
  
  async getNetworkPolicyById(id: number): Promise<NetworkPolicyData | undefined> {
    try {
      const [policy] = await db.select({
        id: networkPolicies.id,
        clusterId: networkPolicies.clusterId,
        name: networkPolicies.name,
        namespace: networkPolicies.namespace,
        type: networkPolicies.type,
        direction: networkPolicies.direction,
        status: networkPolicies.status,
        detectedAt: networkPolicies.detectedAt,
        metadata: networkPolicies.metadata
      })
      .from(networkPolicies)
      .where(eq(networkPolicies.id, id));
      
      if (!policy) return undefined;
      
      return {
        id: policy.id,
        clusterId: policy.clusterId,
        name: policy.name,
        namespace: policy.namespace,
        type: policy.type,
        direction: policy.direction,
        status: policy.status,
        detectedAt: new Date(policy.detectedAt).toISOString(),
        metadata: policy.metadata as Record<string, any> || {}
      };
    } catch (error) {
      console.error(`Error fetching network policy with ID ${id} from database:`, error);
      return undefined;
    }
  }

  // Helper method to initialize database with sample data if needed
  async initializeWithSampleData() {
    // Check if we have any clusters already
    const existingClusters = await db.select().from(clusters);
    const existingNamespaces = await db.select().from(namespaces);
    
    let skipClusters = existingClusters.length > 0;
    let skipNamespaces = existingNamespaces.length > 0;
    
    if (skipClusters && skipNamespaces) {
      console.log("Database already contains cluster and namespace data, skipping initialization");
      return;
    }
    
    if (!skipClusters) {
      console.log("Initializing database with sample cluster data");
    }
    
    // Sample data to insert
    const sampleClusters = [
      {
        clusterId: "gke-prod-cluster1",
        name: "gke-prod-cluster1",
        provider: "GKE",
        version: "1.26.5-gke.1200",
        versionStatus: "Up to date",
        region: "us-central1",
        status: "Healthy",
        nodesTotal: 12,
        nodesReady: 12,
        podsTotal: 450,
        podsRunning: 324,
        namespaces: 14,
        services: 28,
        deployments: 32,
        ingresses: 8,
        metadata: {
          events: [
            {
              timestamp: "2023-07-20T14:30:00Z",
              severity: "info",
              message: "Autoscaling triggered: scaling up to 12 nodes",
              source: "cluster-autoscaler"
            },
            {
              timestamp: "2023-07-20T13:15:00Z",
              severity: "warning",
              message: "High CPU usage detected in namespace: backend",
              source: "monitoring-controller"
            }
          ],
          nodes: [
            {
              name: "gke-prod-cluster1-default-pool-12345",
              status: "Ready",
              role: "Worker",
              cpu: "4 cores / 75%",
              memory: "16GB / 68%",
              pods: "29/30"
            },
            {
              name: "gke-prod-cluster1-default-pool-67890",
              status: "Ready",
              role: "Worker",
              cpu: "4 cores / 62%",
              memory: "16GB / 55%",
              pods: "26/30"
            }
          ]
        }
      },
      {
        clusterId: "gke-stage-cluster1",
        name: "gke-stage-cluster1",
        provider: "GKE",
        version: "1.25.8-gke.500",
        versionStatus: "Update available",
        region: "us-west1",
        status: "Healthy",
        nodesTotal: 8,
        nodesReady: 8,
        podsTotal: 300,
        podsRunning: 210,
        namespaces: 10,
        services: 18,
        deployments: 24,
        ingresses: 6
      },
      {
        clusterId: "aks-prod-eastus",
        name: "aks-prod-eastus",
        provider: "AKS",
        version: "1.25.6",
        versionStatus: "Update available",
        region: "eastus",
        status: "Warning",
        nodesTotal: 6,
        nodesReady: 6,
        podsTotal: 250,
        podsRunning: 178,
        namespaces: 8,
        services: 14,
        deployments: 18,
        ingresses: 4
      },
      {
        clusterId: "aks-dev-westeu",
        name: "aks-dev-westeu",
        provider: "AKS",
        version: "1.26.0",
        versionStatus: "Up to date",
        region: "westeurope",
        status: "Critical",
        nodesTotal: 4,
        nodesReady: 3,
        podsTotal: 120,
        podsRunning: 86,
        namespaces: 6,
        services: 10,
        deployments: 12,
        ingresses: 2
      },
      {
        clusterId: "eks-prod-useast1",
        name: "eks-prod-useast1",
        provider: "EKS",
        version: "1.26.4",
        versionStatus: "Up to date",
        region: "us-east-1",
        status: "Healthy",
        nodesTotal: 10,
        nodesReady: 10,
        podsTotal: 380,
        podsRunning: 342,
        namespaces: 12,
        services: 24,
        deployments: 30,
        ingresses: 7,
        metadata: {
          events: [
            {
              timestamp: "2023-07-18T09:15:00Z",
              severity: "info",
              message: "Kubernetes version update completed",
              source: "cluster-updater"
            }
          ],
          nodes: [
            {
              name: "eks-prod-useast1-node-01",
              status: "Ready",
              role: "Worker",
              cpu: "4 cores / 68%",
              memory: "16GB / 72%",
              pods: "28/30"
            },
            {
              name: "eks-prod-useast1-node-02",
              status: "Ready",
              role: "Worker",
              cpu: "4 cores / 70%",
              memory: "16GB / 65%",
              pods: "27/30"
            }
          ]
        }
      }
    ];
    
    try {
      // Insert sample cluster data if needed
      if (!skipClusters) {
        await db.insert(clusters).values(sampleClusters);
        console.log("Sample cluster data inserted successfully");
      }
      
      // Initialize sample namespaces if needed
      if (!skipNamespaces) {
        console.log("Initializing database with sample namespace data");
        
        // Get all existing cluster IDs from the database
        const clusterResults = await db.select({ clusterId: clusters.clusterId }).from(clusters);
        const existingClusterIds = clusterResults.map(row => row.clusterId);
        
        console.log("Existing cluster IDs:", existingClusterIds);
        
        // Define all possible namespaces
        const allSampleNamespaces = [
          // gke-prod-cluster1 namespaces
          {
            clusterId: "gke-prod-cluster1",
            name: "default",
            status: "Active",
            age: "423d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "default",
              "environment": "production"
            },
            annotations: { 
              "kubernetes.io/description": "Default namespace"
            },
            podCount: 12,
            resourceQuota: false
          },
          {
            clusterId: "gke-prod-cluster1",
            name: "kube-system",
            status: "Active",
            age: "423d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "kube-system",
              "environment": "system" 
            },
            annotations: { 
              "kubernetes.io/description": "System components"
            },
            podCount: 18,
            resourceQuota: false
          },
          {
            clusterId: "gke-prod-cluster1",
            name: "monitoring",
            status: "Active",
            age: "378d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "monitoring",
              "environment": "production",
              "app": "prometheus"
            },
            annotations: { 
              "kubernetes.io/description": "Monitoring components"
            },
            podCount: 8,
            resourceQuota: true
          },
          {
            clusterId: "gke-prod-cluster1",
            name: "backend",
            status: "Active",
            age: "182d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "backend",
              "environment": "production",
              "app": "backend-api",
              "team": "platform" 
            },
            annotations: { 
              "kubernetes.io/description": "Backend services"
            },
            podCount: 14,
            resourceQuota: true
          },
          // aks-prod-eastus namespaces
          {
            clusterId: "aks-prod-eastus",
            name: "default",
            status: "Active",
            age: "321d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "default",
              "environment": "production" 
            },
            annotations: { 
              "kubernetes.io/description": "Default namespace"
            },
            podCount: 5,
            resourceQuota: false
          },
          {
            clusterId: "aks-prod-eastus",
            name: "database",
            status: "Active",
            age: "250d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "database",
              "environment": "production",
              "app": "postgres",
              "team": "data" 
            },
            annotations: { 
              "kubernetes.io/description": "Database services"
            },
            podCount: 6,
            resourceQuota: true
          },
          // eks-prod-useast1 namespaces - These will only be added if the cluster exists
          {
            clusterId: "eks-prod-useast1",
            name: "default",
            status: "Active",
            age: "180d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "default",
              "environment": "production" 
            },
            annotations: { 
              "kubernetes.io/description": "Default namespace"
            },
            podCount: 8,
            resourceQuota: false
          },
          {
            clusterId: "eks-prod-useast1",
            name: "kube-system",
            status: "Active",
            age: "180d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "kube-system",
              "environment": "system" 
            },
            annotations: { 
              "kubernetes.io/description": "System components"
            },
            podCount: 15,
            resourceQuota: false
          },
          {
            clusterId: "eks-prod-useast1",
            name: "microservices",
            status: "Active",
            age: "156d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "microservices",
              "environment": "production",
              "app": "services",
              "team": "platform" 
            },
            annotations: { 
              "kubernetes.io/description": "Microservices environment"
            },
            podCount: 32,
            resourceQuota: true
          },
          {
            clusterId: "eks-prod-useast1",
            name: "data-analytics",
            status: "Active",
            age: "98d",
            phase: "Active",
            labels: { 
              "kubernetes.io/metadata.name": "data-analytics",
              "environment": "production",
              "app": "analytics",
              "team": "data" 
            },
            annotations: { 
              "kubernetes.io/description": "Data analytics services"
            },
            podCount: 18,
            resourceQuota: true
          }
        ];
        
        // Filter out namespaces for non-existent clusters
        const validNamespaces = allSampleNamespaces.filter(ns => 
          existingClusterIds.includes(ns.clusterId)
        );
        
        console.log(`Inserting ${validNamespaces.length} namespaces for existing clusters`);
        
        if (validNamespaces.length > 0) {
          await db.insert(namespaces).values(validNamespaces);
          console.log("Sample namespace data inserted successfully");
        } else {
          console.log("No valid namespaces to insert (all referenced clusters are missing)");
        }
      }
    } catch (error) {
      console.error("Error inserting sample data:", error);
    }
  }
}

// Create storage instance
export const storage = new DatabaseStorage();
