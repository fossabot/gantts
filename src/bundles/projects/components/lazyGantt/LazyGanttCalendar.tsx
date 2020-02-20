import { LazyProject, LazyTask, LazyTaskGroup, TaskType, WeekBitMask } from '../../types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useComponentSize from '@rehooks/component-size';
import { DateStep, IterableDate } from '../../../date/iterableDate';
import { dayToWeekBit, weekBitToDay } from '../../utils';
import GroupAtom from './calendar/GroupAtom';
import { Map } from 'immutable';
import { Linker } from './calendar/Linker';
import { log, useTraceUpdate } from '../../../common/hooks/useTraceUpdate';
import { noop } from '../../../common/lib/noop';
import { Spinner } from 'react-bootstrap';
import _ from 'lodash';
import { useMultiCollection, useSimpleCollection } from '../../../firebase/hooks/useSimpleReference';
import styled, { css } from 'styled-components';
import { ProjectLine } from './calendar/ProjectLine';
import { LGanttContext } from './LazyGantt';

interface CalendarContextType {
  atomElements: Map<string, HTMLElement>;
  setAtomRef: (taskID: string, element: HTMLElement | null) => void;
}

export const CalendarContext = createContext<CalendarContextType>({
  atomElements: Map<string, HTMLElement>(),
  setAtomRef: noop,
});

const Header = styled.p`
    display: flex;
    height: ${props => props.theme.headerHeight}px;
    justify-content: center;
    align-items: center;
    margin: 0;
    font-size: 11px;
    color: #62676d;
    border-bottom: 1px solid #eaeaea;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
`;

const DateColumn = styled.div<{ lastInWeek?: boolean; isToday?: boolean; isWeekend?: boolean }>`
  height: 100%;
  width: 29px;
  flex: 0 0 auto;
  font-size: 11px;
  padding: 4px 0 0;
  box-sizing: border-box;
  text-align: center;
  color: #555960;
  
  ${props => (props.isToday) && css`
    background-color: ${({ theme }) => theme.colors.lightgrey};
  `}
  
  ${props => (props.isWeekend) && css`
    background-color: ${({ theme }) => theme.colors.weekend};
  `}
  
  &:not(:last-child) {
    border-right: 1px solid ${({ theme }) => theme.colors.lightgrey2};
    ${props => (props.lastInWeek) && css`
      border-right: 1px solid ${({ theme }) => theme.colors.grey};
    `}
  }
`;

interface GanttCalendarProps {
  project: LazyProject;
}

export const LazyGanttCalendar: React.FC<GanttCalendarProps> = ({ project }) => {
  const { startDate, daysInWeekBitMask: weekMask, taskGroups } = project;
  
  const calendarContainer = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const size = useComponentSize(calendarContainer);
  const { sharedState } = useContext(LGanttContext)!;
  const endDateCandidate = startDate.clone().addMonths(2);
  const [endMonth, setEndMonth] = useState(endDateCandidate.clone().moveToLastDayOfMonth().compareTo(Date.today()) < 0 ? Date.today().moveToLastDayOfMonth() : endDateCandidate);
  const [lastDayInWeek, setLastDayInWeek] = useState(-1);
  const taskGhost = useRef<HTMLDivElement>(null);
  const [iterableDate, setIterableDate] = useState<IterableDate>();
  const [groups, loading, error] = useSimpleCollection<LazyTaskGroup>(project.taskGroups());
  const [tasks] = useMultiCollection<LazyTask>(groups?.map(g => g.tasks()));
  
  useTraceUpdate({ tasks, groups });
  
  const [links, setLinks] = useState<[string, string, boolean, boolean][] | null>(null);
  const [atomElements, setAtomElements] = useState(Map<string, HTMLElement>());
  
  let promise: Promise<void> | null = null;
  useEffect(() => {
    promise = promise || (async () => {
      const newLinks: [string, string, boolean, boolean][] = [];
      for (let task of tasks.flat(1)) {
        for (let dependency of task.dependsOn?.() ?? []) {
          const depTask = (await dependency.get()).data() as LazyTask;
          if (!depTask) { continue; }
          newLinks.push([
            depTask.uid,
            task.uid,
            depTask.type == TaskType.Milestone,
            task.type == TaskType.Milestone,
          ]);
        }
      }
      if (!_.isEqual(newLinks, links)) {
        console.log('Tasks was changed');
        setLinks(newLinks);
        promise = null;
      }
    })();
  }, [tasks]);
  
  useEffect(() => {
    setIterableDate(new IterableDate(startDate.clone(), endMonth));
  }, [endMonth]);
  
  useEffect(() => {
    if (weekMask == WeekBitMask.All) {
      console.log(weekMask, WeekBitMask.All);
      setLastDayInWeek(-1);
    } else {
      let _lastDayInWeek = WeekBitMask.Sunday;
      if (!(weekMask & WeekBitMask.Sunday)) {
        for (let entry of Object.entries(WeekBitMask).reverse().filter((e) => typeof e[1] === 'number' && e[1] !== 0 && e[1] !== 254)) {
          if (weekMask & entry[1] as number) {
            _lastDayInWeek = entry[1] as number;
            break;
          }
        }
      }
      if (_lastDayInWeek !== lastDayInWeek) {
        setLastDayInWeek(weekBitToDay[_lastDayInWeek]);
      }
    }
  }, [weekMask]);
  
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    console.log('Scrolling Calendar', event.currentTarget.scrollLeft + size.width + 200 > event.currentTarget.scrollWidth);
    if (event.currentTarget.scrollLeft + size.width + 200 > event.currentTarget.scrollWidth) {
      setEndMonth(prev => prev.clone().addMonths(1));
    }
  }, [endMonth, setEndMonth, size]);
  
  const resolveDate = useCallback((date: Date): Date | null => {
    let result = date.compareTo(project.startDate.clone().moveToFirstDayOfMonth()) > 0 ? date.clone() : project.startDate.clone().moveToFirstDayOfMonth();
    if (!(weekMask & WeekBitMask.None)) {
      let iteration = 0;
      while (!(weekMask & dayToWeekBit[result.getDay()])) {
        result.addDays(1);
        iteration++;
        if (iteration > 7) {
          throw new Error('Week resolve overflow');
        }
      }
      return result;
    }
    return null;
  }, []);
  
  const resizeGroup = useCallback(async (group: LazyTaskGroup, start: Date, end: Date) => {
    await project.taskGroups().doc(group.uid).update({ start, end });
  }, []);
  
  const [atoms, updateAtoms] = useState<JSX.Element[]>([]);
  const getDateColumn = useCallback(date => {
    const resolvedDate = resolveDate(date)!;
    return document.getElementById(resolvedDate.toDateString())!;
  }, []);
  
  useEffect(() => {
    log('groups fetched: ', groups);
    const groupsElements: JSX.Element[] = [];
    for (let group of groups ?? []) {
      let groupComponent = (
          <GroupAtom key={group.uid} group={group}
                     groupDatesChanged={resizeGroup}
                     getDateColumn={getDateColumn}/>);
      if (groupComponent) {
        groupsElements.push(groupComponent);
      }
    }
    updateAtoms(groupsElements);
  }, [groups]);
  
  useEffect(() => {
    if (calendarContainer.current && calendarContainer.current.scrollWidth <= calendarContainer.current.offsetWidth) {
      setEndMonth(prev => prev.clone().addMonths(1));
    }
  });
  
  const updateRef = useCallback((id: string, element: HTMLElement | null) => {
    setAtomElements(prev => element ? prev.set(id, element) : prev.delete(id));
  },[setAtomElements, atomElements]);
  
  const getProjectDates = useMemo((): { left: number; width: number } | null => {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (let group of groups) {
      const state = sharedState.get(group.uid) as { start: Date | null; end: Date | null };
      if (state && state.start && state.end) {
        if (!minDate || minDate.compareTo(state.start) > 0) {
          minDate = state.start;
        }
        if (!maxDate || maxDate.compareTo(state.end) < 0) {
          maxDate = state.end;
        }
      }
    }
    
    console.log('dates updated', minDate?.toDateString(), maxDate?.toDateString());
    
    if (minDate && maxDate) {
      const startCol = getDateColumn(minDate);
      const endCol = getDateColumn(maxDate);
      const left = startCol.offsetLeft;
      const width = endCol.offsetLeft + endCol.clientWidth - startCol.offsetLeft;
      return { left, width };
    }
    return null;
  }, [sharedState, groups]);
  
  useEffect(
      () => { setTimeout(() => calendarContainer
          .current?.scrollTo({ left: getDateColumn(Date.today()).offsetLeft - calendarContainer.current?.clientWidth / 2, behavior: 'smooth' }), 500); },
      []
  );
  
  if (loading || error) { return <Spinner animation="grow"/>;}
  
  return <CalendarContext.Provider value={{
    atomElements: atomElements,
    setAtomRef: updateRef,
  }}>
    <div className="gantt__calendar_wrapper" ref={calendarContainer} onScroll={handleScroll}>
      <div
          className="gantt__calendar" ref={contentRef}>
        <div className="gantt__calendar_atom gantt__calendar_atom--ghost" ref={taskGhost}/>
        { links && calendarContainer.current && <Linker links={links} container={calendarContainer.current}/> }
        { iterableDate?.iterateByMonths(DateStep.Month).map(date => (
            <div key={date.toString()} className="gantt__calendar_month">
              <Header>{date.toString('MMMM yyyy').toUpperCase()}</Header>
              <div className="gantt__calendar_content">
                {
                  new IterableDate(date.clone().moveToFirstDayOfMonth(), date.clone().moveToLastDayOfMonth()).map(dayDate => {
                    const day = dayDate.getDay();
                    if (!(weekMask & dayToWeekBit[day])) {
                      return null;
                    }
                    return (
                        <DateColumn
                            key={dayDate.toString()}
                            id={dayDate.toDateString()}
                            className="day-data"
                            lastInWeek={day == lastDayInWeek} isToday={dayDate.isToday(Date.today())} isWeekend={day == 6 || day == 0}>
                          {dayDate.toString('dd')}
                        </DateColumn>
                        // {/*<div key={dayDate.toString()}*/}
                        // {/*     id={dayDate.toDateString()}*/}
                        // {/*     className={'day-data gantt__calendar_column' + (day === lastDayInWeek ? ' gantt__calendar_column--last_in_week' : '')}>*/}
                        // {/*  {dayDate.toString('dd')}*/}
                        // {/*</div>*/}
                    );
                  })}
              </div>
            </div>)
        )}
        <ProjectLine width={0} left={0} {...getProjectDates}/>
        {atoms}
      </div>
    </div>
  </CalendarContext.Provider>;
};