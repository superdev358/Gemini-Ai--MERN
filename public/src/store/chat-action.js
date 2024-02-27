import { chatAction } from "./chat";

export const getRecentChat = () => {
  return (dispatch) => {
    const url = "http://localhost:3030/gemini/api/getchathistory";

    fetch(url, { method: "GET" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("server error");
        }

        return response.json();
      })
      .then((data) => {
        dispatch(
          chatAction.recentChatHandler({ recentChat: data.chatHistory })
        );
      })
      .catch((err) => {
        console.log(err);
      });
  };
};

export const sendChatData = (useInput) => {
  return (dispatch) => {
    dispatch(chatAction.chatStart({ useInput: useInput }));

    const url = "http://localhost:3030/gemini/api/chat";

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userInput: useInput.user,
        previousChat: useInput.previousChat,
        chatHistoryId: useInput.chatHistoryId,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          const error = new Error("Server Error");
          throw error;
        }

        return response.json();
      })
      .then((data) => {
        dispatch(
          chatAction.previousChatHandler({
            previousChat: [
              { role: "user", parts: data.user },
              { role: "model", parts: data.gemini },
            ],
          })
        );
        dispatch(chatAction.popChat());
        dispatch(
          chatAction.chatStart({
            useInput: {
              user: data.user,
              gemini: data.gemini,
              isLoader: "no",
            },
          })
        );
        dispatch(getRecentChat());
        dispatch(chatAction.newChatHandler());
        dispatch(
          chatAction.chatHistoryIdHandler({ chatHistoryId: data.chatHistoryId })
        );
      })
      .catch((err) => {
        console.log(err);
        dispatch(chatAction.popChat());
        dispatch(
          chatAction.chatStart({
            useInput: {
              user: useInput.user,
              gemini:
                "<span>Oops! Something went wrong on our end. Please refresh the page and try again. If the issue persists, please contact us for assistance.</span>",
              isLoader: "no",
            },
          })
        );
        dispatch(chatAction.newChatHandler());
      });
  };
};

export const getChat = (chatHistoryId) => {
  return (dispatch) => {
    dispatch(chatAction.loaderHandler());
    const url = "http://localhost:3030/gemini/api/chatdata";

    fetch(url, {
      method: "POST",
      body: JSON.stringify({ chatHistoryId }),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("server error");
        }
        return response.json();
      })
      .then((data) => {
        dispatch(chatAction.loaderHandler());
        const previousChat = data.chats.flatMap((c) => [
          { role: "user", parts: c.message.user },
          { role: "model", parts: c.message.gemini },
        ]);

        const chats = data.chats.map((c) => {
          return {
            user: c.message.user,
            gemini: c.message.gemini,
            id: c._id,
            isLoader: "no",
          };
        });

        const chatHistoryId = data.chatHistory;

        dispatch(chatAction.replacePreviousChat({ previousChat }));
        dispatch(chatAction.replaceChat({ chats }));
        dispatch(chatAction.chatHistoryIdHandler({ chatHistoryId }));
        dispatch(chatAction.newChatHandler());
      })
      .catch((err) => {
        console.log(err);
        dispatch(
          chatAction.replaceChat({
            chats: [
              {
                error: true,
                user: "Hi, is there any issue ? ",
                gemini: "",
                id: 34356556565,
                isLoader: "Oops! I cound't find you chat history",
              },
            ],
          })
        );
        dispatch(chatAction.loaderHandler());
        dispatch(chatAction.chatHistoryIdHandler({ chatHistoryId }));
      });
  };
};
