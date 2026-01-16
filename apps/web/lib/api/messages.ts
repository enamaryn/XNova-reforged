import { apiClient } from "./client";

export interface MessageSender {
  id: string;
  username: string;
}

export interface MessageSummary {
  id: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
  from: MessageSender;
}

export interface MessageDetail extends MessageSummary {
  to: MessageSender;
  fromId: string;
  toId: string;
}

export interface SendMessagePayload {
  toUsername: string;
  subject: string;
  body: string;
}

export function getInbox() {
  return apiClient.get<MessageSummary[]>("/messages/inbox");
}

export function getMessage(messageId: string) {
  return apiClient.get<MessageDetail>(`/messages/${messageId}`);
}

export function sendMessage(payload: SendMessagePayload) {
  return apiClient.post<MessageSummary>("/messages/send", payload);
}

export function deleteMessage(messageId: string) {
  return apiClient.delete<{ success: boolean }>(`/messages/${messageId}`);
}
