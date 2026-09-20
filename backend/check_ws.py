import asyncio
import websockets
import ssl

async def test():
    try:
        async with websockets.connect('ws://127.0.0.1:8000/ws/stream') as ws:
            print("Direct port 8000: CONNECTED")
            await ws.send('{"type": "ping"}')
            pong = await ws.recv()
            print("Direct port 8000 PONG:", pong)
    except Exception as e:
        print("Direct port 8000 FAILED:", e)

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        async with websockets.connect('wss://localhost:5173/ws/stream', ssl=ctx) as ws2:
            print("Vite Proxy port 5173: CONNECTED")
            await ws2.send('{"type": "ping"}')
            pong2 = await ws2.recv()
            print("Vite Proxy port 5173 PONG:", pong2)
    except Exception as e:
        print("Vite Proxy port 5173 FAILED:", e)

if __name__ == "__main__":
    asyncio.run(test())
