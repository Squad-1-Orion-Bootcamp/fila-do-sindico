from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resposta = client.get("/health")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_classifica_vazamento_como_alta():
    resposta = client.post("/classificar", json={"descricao": "Cano vazando na garagem"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["urgencia"] == "alta"
    assert corpo["categoria"] == "hidraulica"
    assert corpo["justificativa"]


def test_descricao_vazia_e_rejeitada():
    resposta = client.post("/classificar", json={"descricao": ""})
    assert resposta.status_code == 422
