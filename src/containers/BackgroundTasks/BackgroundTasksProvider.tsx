import { IMessageContext } from "@saleor/components/messages";
import useNotifier from "@saleor/hooks/useNotifier";
import ApolloClient from "apollo-client";
import React from "react";
import { useApolloClient } from "react-apollo";
import { IntlShape, useIntl } from "react-intl";

import BackgroundTasksContext from "./context";
import { handleTask, queueCustom } from "./tasks";
import { QueuedTask, Task, TaskData, TaskStatus } from "./types";

export const backgroundTasksRefreshTime = 15 * 1000;

// TODO: Remove underscores when working on #575 or similar PR
export function useBackgroundTasks(
  _apolloClient: ApolloClient<any>,
  _notify: IMessageContext,
  _intl: IntlShape
) {
  const idCounter = React.useRef(0);
  const tasks = React.useRef<QueuedTask[]>([]);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      const queue = async () => {
        try {
          await Promise.all(
            tasks.current.map(async task => {
              if (task.status === TaskStatus.PENDING) {
                let status: TaskStatus;

                try {
                  status = await handleTask(task);
                } catch (error) {
                  throw error;
                }
                if (status !== TaskStatus.PENDING) {
                  const taskIndex = tasks.current.findIndex(
                    t => t.id === task.id
                  );
                  tasks.current[taskIndex].status = status;
                }
              }
            })
          );
        } catch (error) {
          throw error;
        }
      };

      queue();
    }, backgroundTasksRefreshTime);

    return () => clearInterval(intervalId);
  });

  function cancel(id: number) {
    tasks.current = tasks.current.filter(task => task.id !== id);
  }

  function queue(type: Task, data?: TaskData) {
    idCounter.current += 1;
    switch (type) {
      case Task.CUSTOM:
        queueCustom(idCounter.current, tasks, data);
        break;
    }

    return idCounter.current;
  }

  return {
    cancel,
    queue
  };
}

const BackgroundTasksProvider: React.FC = ({ children }) => {
  const apolloClient = useApolloClient();
  const notify = useNotifier();
  const intl = useIntl();
  const { cancel, queue } = useBackgroundTasks(apolloClient, notify, intl);

  return (
    <BackgroundTasksContext.Provider
      value={{
        cancel,
        queue
      }}
    >
      {children}
    </BackgroundTasksContext.Provider>
  );
};

BackgroundTasksProvider.displayName = "BackgroundTasksProvider";
export default BackgroundTasksProvider;
