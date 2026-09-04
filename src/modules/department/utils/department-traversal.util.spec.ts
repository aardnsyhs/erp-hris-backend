import {
  DepartmentHierarchyNode,
  DepartmentTraversalUtil,
} from './department-traversal.util';

describe('DepartmentTraversalUtil', () => {
  // Test Fixtures
  const rootA: DepartmentHierarchyNode = {
    id: 'root-a',
    parentId: null,
    level: 0,
    isActive: true,
    code: 'COMPANY',
    name: 'Holding Company',
  };

  const divB: DepartmentHierarchyNode = {
    id: 'div-b',
    parentId: 'root-a',
    level: 1,
    isActive: true,
    code: 'TECH-DIV',
    name: 'Technology Division',
  };

  const deptC: DepartmentHierarchyNode = {
    id: 'dept-c',
    parentId: 'div-b',
    level: 2,
    isActive: true,
    code: 'ENG-DEPT',
    name: 'Engineering Department',
  };

  const unitD: DepartmentHierarchyNode = {
    id: 'unit-d',
    parentId: 'dept-c',
    level: 3,
    isActive: true,
    code: 'BE-UNIT',
    name: 'Backend Unit',
  };

  const divFinance: DepartmentHierarchyNode = {
    id: 'div-fin',
    parentId: 'root-a',
    level: 1,
    isActive: true,
    code: 'FIN-DIV',
    name: 'Finance Division',
  };

  const validFourLevelTree: DepartmentHierarchyNode[] = [
    rootA,
    divB,
    deptC,
    unitD,
    divFinance,
  ];

  describe('buildNodeMap & buildAdjacencyMap', () => {
    it('should build an ID-indexed map from flat nodes', () => {
      const map = DepartmentTraversalUtil.buildNodeMap(validFourLevelTree);
      expect(map.size).toBe(5);
      expect(map.get('root-a')).toEqual(rootA);
      expect(map.get('unit-d')).toEqual(unitD);
      expect(map.get('non-existent')).toBeUndefined();
    });

    it('should build adjacency map correctly with roots and parent-child edges', () => {
      const { parentToChildren, roots, missingParentNodes } =
        DepartmentTraversalUtil.buildAdjacencyMap(validFourLevelTree);

      expect(roots).toEqual(['root-a']);
      expect(missingParentNodes).toEqual([]);
      expect(parentToChildren.get('root-a')).toEqual(['div-b', 'div-fin']);
      expect(parentToChildren.get('div-b')).toEqual(['dept-c']);
      expect(parentToChildren.get('dept-c')).toEqual(['unit-d']);
      expect(parentToChildren.get('unit-d')).toBeUndefined();
    });

    it('should detect missing/orphan parent nodes in buildAdjacencyMap without crashing', () => {
      const orphanNode: DepartmentHierarchyNode = {
        id: 'orphan-1',
        parentId: 'missing-parent-id',
        level: 1,
        isActive: true,
      };

      const { roots, missingParentNodes, parentToChildren } =
        DepartmentTraversalUtil.buildAdjacencyMap([rootA, orphanNode]);

      expect(roots).toEqual(['root-a']);
      expect(missingParentNodes).toEqual(['orphan-1']);
      expect(parentToChildren.get('missing-parent-id')).toEqual(['orphan-1']);
    });
  });

  describe('getDescendants', () => {
    it('should return empty descendants for a single root without children', () => {
      const result = DepartmentTraversalUtil.getDescendants('root-a', [rootA]);

      expect(result.descendantIds.size).toBe(0);
      expect(result.descendants).toEqual([]);
      expect(result.hasCycle).toBe(false);
    });

    it('should return empty descendants for a leaf node', () => {
      const result = DepartmentTraversalUtil.getDescendants(
        'unit-d',
        validFourLevelTree,
      );

      expect(result.descendantIds.size).toBe(0);
      expect(result.descendants).toEqual([]);
    });

    it('should collect all strict descendants excluding the target node itself', () => {
      const result = DepartmentTraversalUtil.getDescendants(
        'div-b',
        validFourLevelTree,
      );

      expect(result.descendantIds.has('div-b')).toBe(false); // Target is EXCLUDED
      expect(result.descendantIds.has('dept-c')).toBe(true);
      expect(result.descendantIds.has('unit-d')).toBe(true);
      expect(result.descendantIds.has('div-fin')).toBe(false); // Sibling is not descendant
      expect(result.descendantIds.size).toBe(2);
      expect(result.descendants.map((d) => d.id)).toEqual(['dept-c', 'unit-d']);
      expect(result.hasCycle).toBe(false);
    });

    it('should collect all descendants for root node in correct BFS order', () => {
      const result = DepartmentTraversalUtil.getDescendants(
        'root-a',
        validFourLevelTree,
      );

      expect(result.descendantIds.size).toBe(4);
      expect(result.descendants.map((d) => d.id)).toEqual([
        'div-b',
        'div-fin',
        'dept-c',
        'unit-d',
      ]);
      expect(result.hasCycle).toBe(false);
    });

    it('should not infinite loop when input contains cyclic references', () => {
      const cyclicNodes: DepartmentHierarchyNode[] = [
        { id: 'node-1', parentId: 'node-3', level: 0, isActive: true },
        { id: 'node-2', parentId: 'node-1', level: 1, isActive: true },
        { id: 'node-3', parentId: 'node-2', level: 2, isActive: true },
      ];

      const result = DepartmentTraversalUtil.getDescendants(
        'node-1',
        cyclicNodes,
      );

      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodeId).toBeDefined();
      expect(result.descendantIds.size).toBe(2); // node-2 and node-3
    });
  });

  describe('getAncestors', () => {
    it('should return empty ancestors for a root node', () => {
      const result = DepartmentTraversalUtil.getAncestors(
        'root-a',
        validFourLevelTree,
      );

      expect(result.ancestorIds).toEqual([]);
      expect(result.ancestors).toEqual([]);
      expect(result.hasCycle).toBe(false);
      expect(result.hasMissingParent).toBe(false);
    });

    it('should return immediate parent for level 1 node', () => {
      const result = DepartmentTraversalUtil.getAncestors(
        'div-b',
        validFourLevelTree,
      );

      expect(result.ancestorIds).toEqual(['root-a']);
      expect(result.ancestors.map((a) => a.id)).toEqual(['root-a']);
      expect(result.hasCycle).toBe(false);
    });

    it('should return ancestors ordered from immediate parent to root for deep leaf node', () => {
      const result = DepartmentTraversalUtil.getAncestors(
        'unit-d',
        validFourLevelTree,
      );

      expect(result.ancestorIds).toEqual(['dept-c', 'div-b', 'root-a']);
      expect(result.ancestors.map((a) => a.id)).toEqual([
        'dept-c',
        'div-b',
        'root-a',
      ]);
      expect(result.hasCycle).toBe(false);
    });

    it('should stop and report missing parent without crashing if parentId is absent', () => {
      const orphanNodes: DepartmentHierarchyNode[] = [
        { id: 'child-1', parentId: 'ghost-parent', level: 1, isActive: true },
      ];

      const result = DepartmentTraversalUtil.getAncestors(
        'child-1',
        orphanNodes,
      );

      expect(result.ancestorIds).toEqual(['ghost-parent']);
      expect(result.ancestors).toEqual([]); // ghost parent not found
      expect(result.hasMissingParent).toBe(true);
      expect(result.missingParentId).toBe('ghost-parent');
      expect(result.hasCycle).toBe(false);
    });

    it('should detect cycles in ancestor chain and avoid infinite loop', () => {
      const cyclicAncestors: DepartmentHierarchyNode[] = [
        { id: 'a', parentId: 'c', level: 0, isActive: true },
        { id: 'b', parentId: 'a', level: 1, isActive: true },
        { id: 'c', parentId: 'b', level: 2, isActive: true },
      ];

      const result = DepartmentTraversalUtil.getAncestors('c', cyclicAncestors);

      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodeId).toBeDefined();
    });
  });

  describe('isDescendant', () => {
    it('should identify direct child as descendant', () => {
      expect(
        DepartmentTraversalUtil.isDescendant(
          'dept-c',
          'div-b',
          validFourLevelTree,
        ),
      ).toBe(true);
    });

    it('should identify indirect grandchild as descendant', () => {
      expect(
        DepartmentTraversalUtil.isDescendant(
          'unit-d',
          'root-a',
          validFourLevelTree,
        ),
      ).toBe(true);
      expect(
        DepartmentTraversalUtil.isDescendant(
          'unit-d',
          'div-b',
          validFourLevelTree,
        ),
      ).toBe(true);
    });

    it('should identify self as in subtree (self-parent prevention)', () => {
      expect(
        DepartmentTraversalUtil.isDescendant(
          'div-b',
          'div-b',
          validFourLevelTree,
        ),
      ).toBe(true);
    });

    it('should return false for sibling (sibling is not descendant)', () => {
      expect(
        DepartmentTraversalUtil.isDescendant(
          'div-fin',
          'div-b',
          validFourLevelTree,
        ),
      ).toBe(false);
    });

    it('should return false for ancestor (ancestor is not descendant)', () => {
      expect(
        DepartmentTraversalUtil.isDescendant(
          'root-a',
          'dept-c',
          validFourLevelTree,
        ),
      ).toBe(false);
    });
  });

  describe('calculateSubtreeHeight', () => {
    it('should return 0 for leaf node (unit-d)', () => {
      const height = DepartmentTraversalUtil.calculateSubtreeHeight(
        'unit-d',
        validFourLevelTree,
      );
      expect(height).toBe(0);
    });

    it('should return 1 for parent with only direct children (dept-c has unit-d)', () => {
      const height = DepartmentTraversalUtil.calculateSubtreeHeight(
        'dept-c',
        validFourLevelTree,
      );
      expect(height).toBe(1);
    });

    it('should return 2 for division with grandchildren (div-b -> dept-c -> unit-d)', () => {
      const height = DepartmentTraversalUtil.calculateSubtreeHeight(
        'div-b',
        validFourLevelTree,
      );
      expect(height).toBe(2);
    });

    it('should return 3 for root node in a 4-level tree (0 -> 1 -> 2 -> 3)', () => {
      const height = DepartmentTraversalUtil.calculateSubtreeHeight(
        'root-a',
        validFourLevelTree,
      );
      expect(height).toBe(3);
    });
  });

  describe('calculateExpectedTargetLevel', () => {
    it('should return level 0 when candidateParentId is null (promote to root)', () => {
      const result = DepartmentTraversalUtil.calculateExpectedTargetLevel(
        null,
        validFourLevelTree,
      );

      expect(result.isValid).toBe(true);
      expect(result.level).toBe(0);
    });

    it('should return parent.level + 1 when candidateParentId is valid', () => {
      // Reparenting under div-b (level 1) -> expected target level = 2
      const result = DepartmentTraversalUtil.calculateExpectedTargetLevel(
        'div-b',
        validFourLevelTree,
      );

      expect(result.isValid).toBe(true);
      expect(result.level).toBe(2);
    });

    it('should return invalid when candidateParentId does not exist', () => {
      const result = DepartmentTraversalUtil.calculateExpectedTargetLevel(
        'non-existent-parent',
        validFourLevelTree,
      );

      expect(result.isValid).toBe(false);
      expect(result.level).toBe(-1);
      expect(result.error).toContain('tidak ditemukan');
    });
  });

  describe('validateReparentDepth', () => {
    it('should allow valid reparent within 4 levels (0 to 3)', () => {
      // Node with subtree height 1 moved to level 2: 2 + 1 = 3 <= 3 (Valid)
      const result = DepartmentTraversalUtil.validateReparentDepth(2, 1, 3);

      expect(result.isValid).toBe(true);
      expect(result.maxSubtreeLevel).toBe(3);
    });

    it('should allow leaf node moved to level 3: 3 + 0 = 3 <= 3 (Valid)', () => {
      const result = DepartmentTraversalUtil.validateReparentDepth(3, 0, 3);

      expect(result.isValid).toBe(true);
      expect(result.maxSubtreeLevel).toBe(3);
    });

    it('should reject reparent that causes level 4 (depth of 5)', () => {
      // Node with subtree height 2 moved to level 2: 2 + 2 = 4 > 3 (Invalid)
      const result = DepartmentTraversalUtil.validateReparentDepth(2, 2, 3);

      expect(result.isValid).toBe(false);
      expect(result.maxSubtreeLevel).toBe(4);
      expect(result.error).toContain(
        'Batas kedalaman hierarki maksimum (4 level: level 0 hingga 3) terlampaui',
      );
    });

    it('should reject leaf node moved to level 4: 4 + 0 = 4 > 3 (Invalid)', () => {
      const result = DepartmentTraversalUtil.validateReparentDepth(4, 0, 3);

      expect(result.isValid).toBe(false);
      expect(result.maxSubtreeLevel).toBe(4);
    });
  });

  describe('findArchivedAncestors (Restore & Create Guard)', () => {
    it('should return empty array if all ancestors are active', () => {
      const archived = DepartmentTraversalUtil.findArchivedAncestors(
        'unit-d',
        validFourLevelTree,
      );
      expect(archived).toEqual([]);
    });

    it('should identify archived ancestors when an ancestor is archived', () => {
      const treeWithArchivedAncestor: DepartmentHierarchyNode[] = [
        rootA,
        { ...divB, isActive: false }, // Archived Div
        deptC,
        unitD,
      ];

      const archived = DepartmentTraversalUtil.findArchivedAncestors(
        'unit-d',
        treeWithArchivedAncestor,
      );

      expect(archived.length).toBe(1);
      expect(archived[0].id).toBe('div-b');
      expect(archived[0].isActive).toBe(false);
    });

    it('should identify multiple archived ancestors in chain', () => {
      const treeWithMultipleArchived: DepartmentHierarchyNode[] = [
        { ...rootA, isActive: false },
        { ...divB, isActive: false },
        deptC,
      ];

      const archived = DepartmentTraversalUtil.findArchivedAncestors(
        'dept-c',
        treeWithMultipleArchived,
      );

      expect(archived.length).toBe(2);
      expect(archived.map((a) => a.id)).toEqual(['div-b', 'root-a']);
    });
  });

  describe('findActiveDescendants (Archive Guard)', () => {
    it('should return all active descendants of a department', () => {
      const activeDesc = DepartmentTraversalUtil.findActiveDescendants(
        'div-b',
        validFourLevelTree,
      );

      expect(activeDesc.length).toBe(2);
      expect(activeDesc.map((d) => d.id)).toEqual(['dept-c', 'unit-d']);
    });

    it('should return empty array if all descendants are archived', () => {
      const treeWithArchivedDescendants: DepartmentHierarchyNode[] = [
        rootA,
        divB,
        { ...deptC, isActive: false },
        { ...unitD, isActive: false },
      ];

      const activeDesc = DepartmentTraversalUtil.findActiveDescendants(
        'div-b',
        treeWithArchivedDescendants,
      );

      expect(activeDesc).toEqual([]);
    });

    it('should detect deep active grandchild even if direct child is archived', () => {
      const treeWithArchivedChildActiveGrandchild: DepartmentHierarchyNode[] = [
        rootA,
        divB,
        { ...deptC, isActive: false }, // direct child archived
        { ...unitD, isActive: true }, // grandchild active
      ];

      const activeDesc = DepartmentTraversalUtil.findActiveDescendants(
        'div-b',
        treeWithArchivedChildActiveGrandchild,
      );

      expect(activeDesc.length).toBe(1);
      expect(activeDesc[0].id).toBe('unit-d');
    });
  });
});
