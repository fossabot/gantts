import Immutable from 'immutable';
import _ from 'lodash';
import { LazyUserInfo, User, UserInfo } from '../../user/types';
import { CollectionReference, DocumentReference, DocumentReferencePath, LazyCollectionReference, LazyReference } from '../../firebase/types';
import { Colors, Palette } from '../colors';
import firebase from 'firebase';

export type ProjectID = string;
export type TaskGroupID = string;

export interface SharedState {
  progress: number;
  assigned?: LazyUserInfo[];
  start?: Date;
  end?: Date;
}

export interface ProjectsState {
  documents: Immutable.Map<string, RemoteDocument[]>;
  calculatedProperties: Immutable.Map<string, SharedState>;
  groups: Immutable.Map<string, TaskGroup[]>;
  tasks: Immutable.Map<string, Task[]>;
  attachedProjects: Immutable.Map<string, (() => void)[]>;
  isFailed?: Error;
  isLoading: boolean;
}

export interface ProjectCreator extends Discussable, WithDocs, WithNotes, WithHistory {
  title: string;
  startDate: Date;
  daysInWeekBitMask: WeekBitMask; // 1001001 mask
}

export enum ProjectState {
  Active,
  OnHold,
  Complete,
}

export interface Project extends ProjectCreator {
  uid: string;
  state: ProjectState;
  selfReference: () => DocumentReference;
  owner: () => DocumentReference;
  enrolled: () => CollectionReference;
  taskGroups: () => CollectionReference;
}

export enum CalendarScale {
  Days,
  Weeks,
  Months,
}

export enum WeekBitMask {
  None,
  Sunday = 1 << 1,
  Monday = 1 << 2,
  Tuesday = 1 << 3,
  Wednesday = 1 << 4,
  Thursday = 1 << 5,
  Friday = 1 << 6,
  Saturday = 1 << 7,
  All = Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday,
}

type DocumentID = string;

export interface Orderable {
  next?: DocumentID;
}

export interface TaskGroupConstructor extends Discussable, WithNotes, WithDocs, WithHistory {
  title: string;
  projectID: ProjectID;
}

export interface TaskGroup extends TaskGroupConstructor, Orderable {
  uid: string;
  selfReference: () => DocumentReference;
  tasks: () => CollectionReference;
  taskGroups: () => CollectionReference;
}

export interface TaskConstructor extends Discussable, WithNotes, WithDocs, WithHistory {
  title: string;
  progress?: number;
  start?: Date;
  end?: Date;
  project: () => DocumentReference;
  parentGroup: () => DocumentReference;
}

export enum TaskType {
  Task, Milestone,
}

export interface Task extends TaskConstructor, Orderable {
  uid: string;
  color: Colors<Palette>;
  type: TaskType;
  subtasks: Subtask[];
  selfReference: () => DocumentReference;
  dependsOn?: () => DocumentReference[];
  dependentOn?: () => DocumentReference[];
  assignedUsers: string[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Subtask {
  title: string;
  id: string;
  completed: boolean;
}

export interface HistorySnapshot {
  performedAction: string;
  changes: string;
  date: Date;
  message?: string;
}

export interface RemoteDocument {
  uid: string;
  refPath: string;
  downloadURL: string;
  title: string;
  updatedAt: Date;
  author: string;
  versions: string[];
  description: string;
}

export interface Message {
  uid: string;
  creator: string;
  updatedAt: Date;
  documents?: string[];
  content: string;
}

export interface Discussable {
  comments: Message[];
}

export interface WithNotes {
  note: string;
}

export interface WithDocs {
  documents: RemoteDocument[];
}

export interface WithHistory {
  history: HistorySnapshot[];
}

export interface Meta {
  path: DocumentReference;
  owner?: LazyUserInfo;
  assigns?: LazyUserInfo[];
  enrolled?: LazyUserInfo[];
}

export interface GanttProps {
  project: Project;
}

