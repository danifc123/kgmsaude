def test_deveria_retornar_status_ok_quando_api_estiver_no_ar(client):
    # Arrange
    endpoint = "/api/health"

    # Act
    response = client.get(endpoint)

    # Assert
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
