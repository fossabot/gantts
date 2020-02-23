import React, { useContext, useEffect, useState } from 'react';
import { LazyProject, LazyTask, LazyTaskGroup } from '../../../types';
import { MetaColumn } from '../styled/meta';
import { useHover } from 'react-use-gesture';
import { TaskAtom } from './TaskAtom';
import { allTasks, clearDependencies } from '../../../firebase/models';
import { LGanttContext, Meta } from '../LazyGantt';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { useSimpleCollection } from '../../../../firebase/hooks/useSimpleReference';
import { prettyNum } from '../../utils';
import { ExtraTools } from './ExtraTools';
import { linkedSorter } from '../helpers';
import { useTypedSelector } from '../../../../../redux/rootReducer';
import { useModal } from '../../../../common/modal/context';
import { ProjectForm } from '../../forms/edit/wrappers/ProjectForm';
import { GroupForm } from '../../forms/edit/wrappers/GroupForm';

interface Props {
  group: LazyTaskGroup;
  level: number;
}

export interface GroupState {
  progress?: number;
  collapsed?: boolean;
}

export const GroupAtom: React.FC<Props> = ({ group, level }) => {
  const { title } = group;
  const { sharedState, writeSharedState } = useContext(LGanttContext)!;
  const groupState = useTypedSelector(state => state.projectsState.calculatedProperties.get(group.uid));
  const meta = sharedState.get(group.uid) as GroupState | undefined;
  const [isHovered, setHovered] = useState(false);
  const hovered = useHover(({ hovering }) => setHovered(hovering));
  const [subGroups] = useSimpleCollection<LazyTaskGroup>(group.taskGroups());
  const [tasks] = useSimpleCollection<LazyTask>(group.tasks());
  
  const { showModal } = useModal(<GroupForm group={group}/>, { size: 'xl', animation: false });
  
  return (
      <>
        <div
            id={group.uid}
            className={'gantt__atom_meta gantt__atom_meta--group' + (isHovered ? ' gantt__atom_meta--active' : '')}
            {...hovered()}
        >
          <MetaColumn type="extra">
            <ExtraTools target={group} isParentHovered={isHovered}/>
          </MetaColumn>
          <MetaColumn type="main" style={{ paddingLeft: `calc(${level}rem + 8px)` }}>
            {<span>{title}</span>}
            <span className="project_manager__task_group_collapse" onClick={() => writeSharedState(group.uid, { collapsed: !meta?.collapsed })}>
        <span className={'fas ' + (meta?.collapsed ? 'fa-caret-right' : 'fa-caret-down')} />
      </span>
            <span className="gantt__atom_meta_toolbar" style={{ display: isHovered ? undefined : 'none' }}>
      <span className="badge toolbar__button link" onClick={showModal}>
        <span className="fas fa-pen"/>
      </span>
      <span className="badge toolbar__button link" onClick={async () => {
        const promises: Promise<void>[] = [];
        for (let task of await allTasks(group) ?? []) {
          promises.push(clearDependencies(task));
        }
        await Promise.all(promises);
        await (await group.selfReference().parent.where('next', '==', group.uid).get()).docs[0]?.ref.update({ next: group.next ?? null });
        await group.selfReference().delete();
      }}>
        <span className="fas fa-times"/>
      </span>
      <span className="badge toolbar__button link">
        <span className="fas fa-ellipsis-v"/>
      </span>
    </span>
          </MetaColumn>
          <MetaColumn type="assigns"/>
          <MetaColumn type="progress" style={{ justifyContent: 'center', textAlign: 'center' }}>{ prettyNum(Math.floor((groupState?.progress ?? 0) * 10)/10) }%</MetaColumn>
        </div>
        { !meta?.collapsed && (
            <>
              { tasks?.map(task => <TaskAtom key={task.uid} task={task} level={level + 1}/>)}
              { subGroups?.sort(linkedSorter(el => el.uid)).reverse().map(group => <GroupAtom key={group.uid} level={level + 1} group={group}/>)}
            </>
        )}
      </>
  );
};
