import { http } from 'intellibiz'

http.get('/', (req) => ({ status: 'ok', example: 'ai-assistant' }))

http.listen(3000)
