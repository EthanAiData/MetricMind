from django.urls import path
from . import views

urlpatterns = [
    path('lensindex', views.home, name='lensindex'),
    path('', views.home, name='lensindex'),
]
