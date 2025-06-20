import requests
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    print("Sending request...")
    # res = requests.post(
    #     "https://localhost:2000",
    #     json={"trigger": "sum", "body": {"a": 1, "b": 2}},
    #     verify="./server.crt"  # Verify server cert against this
    # )
    
    # print(res.json())

    # return res.json()
    return {"message": "Hello World"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, port=8000)