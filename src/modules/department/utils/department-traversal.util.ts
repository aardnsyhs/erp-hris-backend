/**
 * Minimal structural representation of a department node for pure hierarchy traversal.
 * Contains only topology and status fields, decoupled from ORM, HTTP, or business services.
 */
export interface DepartmentHierarchyNode {
  id: string;
  parentId: string | null;
  level: number;
  isActive: boolean;
  code?: string;
  name?: string;
}

/**
 * Result of descendant collection traversal.
 */
export interface TraversalDescendantsResult {
  /** Set of IDs of all strict descendants (target node is excluded) */
  descendantIds: Set<string>;
  /** Ordered list of descendant nodes discovered during BFS traversal */
  descendants: DepartmentHierarchyNode[];
  /** Flag indicating if a cyclic reference was encountered in the graph */
  hasCycle: boolean;
  /** ID of the node that closed a cycle, if any */
  cycleNodeId?: string;
}

/**
 * Result of ancestor chain traversal.
 */
export interface TraversalAncestorsResult {
  /** Ordered list of ancestor IDs starting from immediate parent up to root */
  ancestorIds: string[];
  /** Ordered list of ancestor nodes starting from immediate parent up to root */
  ancestors: DepartmentHierarchyNode[];
  /** Flag indicating if a cyclic reference was encountered in the ancestor chain */
  hasCycle: boolean;
  /** ID of the node that closed a cycle, if any */
  cycleNodeId?: string;
  /** Flag indicating if an ancestor referenced a parentId not present in the node set */
  hasMissingParent: boolean;
  /** ID of the missing parent, if any */
  missingParentId?: string;
}

/**
 * Result of adjacency map construction.
 */
export interface AdjacencyMapResult {
  /** Map of parentId -> array of child IDs */
  parentToChildren: Map<string, string[]>;
  /** IDs of all root nodes (parentId === null) */
  roots: string[];
  /** IDs of nodes whose parentId is not present in the input node set */
  missingParentNodes: string[];
}

/**
 * Result of expected target level calculation.
 */
export interface ExpectedLevelResult {
  level: number;
  isValid: boolean;
  error?: string;
}

/**
 * Result of maximum depth evaluation.
 */
export interface DepthValidationResult {
  isValid: boolean;
  maxSubtreeLevel: number;
  newTargetLevel: number;
  subtreeHeight: number;
  error?: string;
}

/**
 * Pure, framework-agnostic utility for department hierarchy traversal, graph integrity checks,
 * and structural validations.
 *
 * Design Guarantees:
 * - Zero dependencies on Prisma, HTTP exceptions, repositories, or services.
 * - Cycle-safe: uses visited sets to prevent infinite loops on corrupt/cyclic legacy data.
 * - Deterministic error results without throwing HTTP exceptions.
 */
export class DepartmentTraversalUtil {
  /**
   * Builds an ID-indexed Map from a flat array of department nodes.
   *
   * Time Complexity: O(N) where N is the number of nodes.
   * Space Complexity: O(N).
   */
  static buildNodeMap(
    nodes: DepartmentHierarchyNode[],
  ): Map<string, DepartmentHierarchyNode> {
    const map = new Map<string, DepartmentHierarchyNode>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }

  /**
   * Helper to normalize nodes input into a Map<string, DepartmentHierarchyNode>.
   */
  private static ensureNodeMap(
    nodesOrMap:
      | DepartmentHierarchyNode[]
      | Map<string, DepartmentHierarchyNode>,
  ): Map<string, DepartmentHierarchyNode> {
    if (nodesOrMap instanceof Map) {
      return nodesOrMap;
    }
    return DepartmentTraversalUtil.buildNodeMap(nodesOrMap);
  }

  /**
   * Builds an adjacency map (parentId -> children IDs) and identifies root/orphan nodes.
   *
   * Time Complexity: O(N).
   * Space Complexity: O(N).
   */
  static buildAdjacencyMap(
    nodes: DepartmentHierarchyNode[],
  ): AdjacencyMapResult {
    const parentToChildren = new Map<string, string[]>();
    const roots: string[] = [];
    const missingParentNodes: string[] = [];
    const nodeIds = new Set(nodes.map((n) => n.id));

    for (const node of nodes) {
      if (node.parentId === null) {
        roots.push(node.id);
      } else {
        if (!nodeIds.has(node.parentId)) {
          missingParentNodes.push(node.id);
        }
        const children = parentToChildren.get(node.parentId) || [];
        children.push(node.id);
        parentToChildren.set(node.parentId, children);
      }
    }

    return { parentToChildren, roots, missingParentNodes };
  }

  /**
   * Collects all strict descendants of the target node using Breadth-First Search (BFS).
   *
   * CONVENTION:
   * - The target node itself is EXCLUDED from `descendantIds` and `descendants`.
   * - Returns only strict children, grandchildren, etc.
   * - Cycle-safe: avoids infinite loops on cyclic legacy graphs.
   *
   * Time Complexity: O(V + E) where V and E are vertices and edges in the target's subtree.
   * Space Complexity: O(V) for visited set and queue.
   */
  static getDescendants(
    targetId: string,
    nodesOrMap:
      | DepartmentHierarchyNode[]
      | Map<string, DepartmentHierarchyNode>,
    adjacencyMap?: Map<string, string[]>,
  ): TraversalDescendantsResult {
    const nodeMap = DepartmentTraversalUtil.ensureNodeMap(nodesOrMap);

    let childMap = adjacencyMap;
    if (!childMap) {
      childMap = new Map<string, string[]>();
      for (const node of nodeMap.values()) {
        if (node.parentId) {
          const list = childMap.get(node.parentId) || [];
          list.push(node.id);
          childMap.set(node.parentId, list);
        }
      }
    }

    const descendantIds = new Set<string>();
    const descendants: DepartmentHierarchyNode[] = [];
    const visited = new Set<string>([targetId]);
    const queue: string[] = [targetId];
    let hasCycle = false;
    let cycleNodeId: string | undefined;

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const childrenIds = childMap.get(currentId) || [];

      for (const childId of childrenIds) {
        if (visited.has(childId)) {
          hasCycle = true;
          cycleNodeId = childId;
          continue; // Guard against cyclic loop
        }

        visited.add(childId);
        descendantIds.add(childId);

        const childNode = nodeMap.get(childId);
        if (childNode) {
          descendants.push(childNode);
        }

        queue.push(childId);
      }
    }

    return { descendantIds, descendants, hasCycle, cycleNodeId };
  }

  /**
   * Collects all ancestors of the target node from its immediate parent up to the root node.
   *
   * CONVENTION:
   * - The target node itself is EXCLUDED from `ancestorIds` and `ancestors`.
   * - `ancestors[0]` is the immediate parent (if any), followed by grandparent, ..., up to root.
   * - Cycle-safe: stops and flags `hasCycle: true` if an ancestor has already been visited.
   * - Missing-parent-safe: stops and flags `hasMissingParent: true` if parentId is not found.
   *
   * Time Complexity: O(H) where H is the height/depth of the target node (at most 4 in valid tree).
   * Space Complexity: O(H).
   */
  static getAncestors(
    targetId: string,
    nodesOrMap:
      | DepartmentHierarchyNode[]
      | Map<string, DepartmentHierarchyNode>,
  ): TraversalAncestorsResult {
    const nodeMap = DepartmentTraversalUtil.ensureNodeMap(nodesOrMap);

    const ancestorIds: string[] = [];
    const ancestors: DepartmentHierarchyNode[] = [];
    const visited = new Set<string>([targetId]);
    let hasCycle = false;
    let cycleNodeId: string | undefined;
    let hasMissingParent = false;
    let missingParentId: string | undefined;

    let currentNode = nodeMap.get(targetId);
    while (currentNode && currentNode.parentId !== null) {
      const parentId = currentNode.parentId;

      if (visited.has(parentId)) {
        hasCycle = true;
        cycleNodeId = parentId;
        break; // Guard against cycle loop
      }

      visited.add(parentId);
      ancestorIds.push(parentId);

      const parentNode = nodeMap.get(parentId);
      if (!parentNode) {
        hasMissingParent = true;
        missingParentId = parentId;
        break; // Stop cleanly when parent record is absent
      }

      ancestors.push(parentNode);
      currentNode = parentNode;
    }

    return {
      ancestorIds,
      ancestors,
      hasCycle,
      cycleNodeId,
      hasMissingParent,
      missingParentId,
    };
  }

  /**
   * Determines whether `candidateParentId` is in the subtree of `targetId`
   * (which would create a cyclic reference if target was reparented under candidateParentId).
   * Also returns true if candidateParentId === targetId (self-parenting).
   *
   * Time Complexity: O(H) by checking ancestor chain of candidateParentId up to root.
   * Space Complexity: O(H).
   */
  static isDescendant(
    candidateParentId: string,
    targetId: string,
    nodesOrMap:
      | DepartmentHierarchyNode[]
      | Map<string, DepartmentHierarchyNode>,
  ): boolean {
    if (candidateParentId === targetId) {
      return true;
    }

    const { ancestorIds } = DepartmentTraversalUtil.getAncestors(
      candidateParentId,
      nodesOrMap,
    );

    return ancestorIds.includes(targetId);
  }

  /**
   * Calculates the maximum structural height of the subtree below targetId.
   *
   * CONVENTION:
   * - Leaf node (no children): returns 0.
   * - Direct children only: returns 1.
   * - Grandchildren: returns 2, etc.
   * - Computed via BFS level distance from target, immune to drift in the DB `level` column.
   *
   * Time Complexity: O(V + E) of target's subtree.
   * Space Complexity: O(V).
   */
  static calculateSubtreeHeight(
    targetId: string,
    nodesOrMap:
      | DepartmentHierarchyNode[]
      | Map<string, DepartmentHierarchyNode>,
  ): number {
    const nodeMap = DepartmentTraversalUtil.ensureNodeMap(nodesOrMap);

    const childMap = new Map<string, string[]>();
    for (const node of nodeMap.values()) {
      if (node.parentId) {
        const list = childMap.get(node.parentId) || [];
        list.push(node.id);
        childMap.set(node.parentId, list);
      }
    }

    const visited = new Set<string>([targetId]);
    const queue: Array<{ id: string; depth: number }> = [
      { id: targetId, depth: 0 },
    ];
    let maxHeight = 0;

    while (queue.length > 0) {
      const { id: currentId, depth: currentDepth } = queue.shift()!;
      const childrenIds = childMap.get(currentId) || [];

      for (const childId of childrenIds) {
        if (!visited.has(childId)) {
          visited.add(childId);
          const childDepth = currentDepth + 1;
          if (childDepth > maxHeight) {
            maxHeight = childDepth;
          }
          queue.push({ id: childId, depth: childDepth });
        }
      }
    }

    return maxHeight;
  }

  /**
   * Calculates expected new level for target based on candidate parent.
   * - candidateParentId === null: level = 0 (Root).
   * - candidateParentId exists: level = parent.level + 1.
   * - candidateParentId not found: returns isValid = false.
   *
   * Time Complexity: O(1).
   * Space Complexity: O(1).
   */
  static calculateExpectedTargetLevel(
    candidateParentId: string | null,
    nodesOrMap:
      | DepartmentHierarchyNode[]
      | Map<string, DepartmentHierarchyNode>,
  ): ExpectedLevelResult {
    if (candidateParentId === null) {
      return { level: 0, isValid: true };
    }

    const nodeMap = DepartmentTraversalUtil.ensureNodeMap(nodesOrMap);
    const parentNode = nodeMap.get(candidateParentId);

    if (!parentNode) {
      return {
        level: -1,
        isValid: false,
        error: `Departemen induk kandidat dengan ID '${candidateParentId}' tidak ditemukan`,
      };
    }

    return {
      level: parentNode.level + 1,
      isValid: true,
    };
  }

  /**
   * Evaluates whether a proposed reparent operation violates the maximum organizational depth.
   * Allowed levels: 0 to maxAllowedLevel (default: 3, representing 4 total levels: 0, 1, 2, 3).
   *
   * Formula: maxSubtreeLevel = newTargetLevel + subtreeHeight <= maxAllowedLevel.
   *
   * Time Complexity: O(1).
   * Space Complexity: O(1).
   */
  static validateReparentDepth(
    newTargetLevel: number,
    subtreeHeight: number,
    maxAllowedLevel: number = 3,
  ): DepthValidationResult {
    const maxSubtreeLevel = newTargetLevel + subtreeHeight;
    const maxAllowedDepthCount = maxAllowedLevel + 1;

    if (maxSubtreeLevel > maxAllowedLevel) {
      return {
        isValid: false,
        maxSubtreeLevel,
        newTargetLevel,
        subtreeHeight,
        error: `Batas kedalaman hierarki maksimum (${maxAllowedDepthCount} level: level 0 hingga ${maxAllowedLevel}) terlampaui. Level target baru (${newTargetLevel}) + tinggi turunan (${subtreeHeight}) = ${maxSubtreeLevel} melebihi batas.`,
      };
    }

    return {
      isValid: true,
      maxSubtreeLevel,
      newTargetLevel,
      subtreeHeight,
    };
  }

  /**
   * Finds all ancestors of target that are currently archived (isActive === false).
   * Used by Restore Guard and Create Ancestor-Chain Safeguard.
   *
   * Time Complexity: O(H).
   * Space Complexity: O(H).
   */
  static findArchivedAncestors(
    targetId: string,
    nodesOrMap:
      | DepartmentHierarchyNode[]
      | Map<string, DepartmentHierarchyNode>,
  ): DepartmentHierarchyNode[] {
    const { ancestors } = DepartmentTraversalUtil.getAncestors(
      targetId,
      nodesOrMap,
    );
    return ancestors.filter((a) => !a.isActive);
  }

  /**
   * Finds all descendants of target that are currently active (isActive === true).
   * Used by Archive Deep Descendant Guard.
   *
   * Time Complexity: O(V + E).
   * Space Complexity: O(V).
   */
  static findActiveDescendants(
    targetId: string,
    nodesOrMap:
      | DepartmentHierarchyNode[]
      | Map<string, DepartmentHierarchyNode>,
  ): DepartmentHierarchyNode[] {
    const { descendants } = DepartmentTraversalUtil.getDescendants(
      targetId,
      nodesOrMap,
    );
    return descendants.filter((d) => d.isActive);
  }
}
