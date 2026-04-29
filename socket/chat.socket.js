module.exports = (io) => {
    io.on("connection", (socket) => {

        console.log("User connected:", socket.id);

        socket.on("joinConversation", (conversation_id) => {
            socket.join("chat_" + conversation_id);
        });

        socket.on("sendMessage", (data) => {
            io.to("chat_" + data.conversation_id)
                .emit("newMessage", data);
        });

        socket.on("disconnect", () => {
            console.log("User disconnected");
        });
    });
};
