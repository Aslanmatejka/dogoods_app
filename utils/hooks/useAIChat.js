import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '../AuthContext.jsx'
import aiChatService from '../services/aiChatService.js'

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  message: "Hi! I'm Nouri, your DoGoods assistant. I can help you find food, share food, check your pickups, get recipes, set reminders, and more. How can I help you today?",
  timestamp: new Date().toISOString(),
}

const INITIAL_MESSAGE_ES = {
  id: 'welcome',
  role: 'assistant',
  message: '¡Hola! Soy Nouri, tu asistente de DoGoods. Puedo ayudarte a encontrar comida, compartir comida, verificar tus recogidas, obtener recetas, crear recordatorios y más. ¿En qué puedo ayudarte hoy?',
  timestamp: new Date().toISOString(),
}

export function useAIChat() {
  const { user, isAuthenticated } = useAuthContext()
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [language, setLanguage] = useState('en')
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Load conversation history from backend when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user?.id || historyLoaded) return

    let cancelled = false
    const loadHistory = async () => {
      try {
        const history = await aiChatService.getHistory(user.id, 50)
        if (cancelled || !history?.length) return

        const formatted = history.map(msg => ({
          id: msg.id || `hist-${msg.created_at}`,
          role: msg.role,
          message: msg.message,
          metadata: msg.metadata,
          timestamp: msg.created_at,
        }))

        setMessages([INITIAL_MESSAGE, ...formatted])
        setHistoryLoaded(true)
      } catch (err) {
        console.error('Failed to load AI history:', err)
      }
    }

    loadHistory()
    return () => { cancelled = true }
  }, [isAuthenticated, user?.id, historyLoaded])

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isLoading) return

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      message: text.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    try {
      const result = await aiChatService.sendMessage(text.trim(), {
        userId: user?.id || 'anonymous',
      })

      // Update language from backend detection
      if (result.lang && result.lang !== language) {
        setLanguage(result.lang)
      }

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        message: result.response,
        audioUrl: result.audioUrl,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        message: language === 'es'
          ? 'Estoy teniendo un pequeño problema. ¿Puedes intentar de nuevo en un momento?'
          : "I'm having a little trouble right now. Please try again in a moment.",
        isError: true,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, errorMsg])
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, language, user?.id])

  const sendVoice = useCallback(async (audioBlob) => {
    if (isLoading || !audioBlob) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await aiChatService.sendVoice(audioBlob, {
        userId: user?.id || 'anonymous',
        includeAudio: true,
      })

      if (result.lang && result.lang !== language) {
        setLanguage(result.lang)
      }

      // Show the transcript as the user message
      if (result.transcript) {
        setMessages(prev => [...prev, {
          id: `user-${Date.now()}`,
          role: 'user',
          message: result.transcript,
          timestamp: new Date().toISOString(),
        }])
      }

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        message: result.response,
        audioUrl: result.audioUrl,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        message: language === 'es'
          ? 'No pude procesar tu audio. Por favor usa el campo de texto.'
          : "I couldn't process your voice message. Please try typing instead.",
        isError: true,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, errorMsg])
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, language, user?.id])

  const clearHistory = useCallback(async () => {
    try {
      if (isAuthenticated && user?.id) {
        await aiChatService.clearHistory(user.id)
      }
      const welcome = language === 'es' ? INITIAL_MESSAGE_ES : INITIAL_MESSAGE
      setMessages([welcome])
      setHistoryLoaded(false)
      setError(null)
    } catch (err) {
      console.error('Failed to clear AI history:', err)
    }
  }, [isAuthenticated, user?.id, language])

  const submitFeedback = useCallback(async (messageId, rating) => {
    if (!isAuthenticated || !user?.id) return
    try {
      await aiChatService.submitFeedback(messageId, user.id, rating)
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    }
  }, [isAuthenticated, user?.id])

  return {
    messages,
    sendMessage,
    sendVoice,
    isLoading,
    error,
    language,
    setLanguage,
    clearHistory,
    submitFeedback,
    isAuthenticated,
  }
}
