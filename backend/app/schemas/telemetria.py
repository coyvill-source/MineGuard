from pydantic import BaseModel, Field


class IngestaArchivoRespuesta(BaseModel):
    filas_procesadas: int
    filas_descartadas: int
    punto_control_id: int


class IngestaAleatoriaSolicitud(BaseModel):
    punto_control_id: int
    cantidad: int = Field(gt=0, le=5000)


class IngestaAleatoriaRespuesta(BaseModel):
    filas_generadas: int
    punto_control_id: int
