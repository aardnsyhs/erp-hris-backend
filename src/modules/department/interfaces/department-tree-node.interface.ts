export interface DepartmentTreeNode {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  archivedAt: Date | null;
  parentId: string | null;
  level: number;
  _count: {
    employees: number;
    children: number;
  };
  children: DepartmentTreeNode[];
}
