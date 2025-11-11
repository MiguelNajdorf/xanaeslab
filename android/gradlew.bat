@ECHO OFF
SET DIR=%~dp0
SET JAVA_EXE=%JAVA_HOME%\bin\java.exe
IF NOT EXIST "%JAVA_EXE%" (
  ECHO JAVA_HOME is not set and no 'java' command could be found in your PATH.
  EXIT /B 1
)
"%JAVA_EXE%" -Xmx64m -Xms64m -classpath "%DIR%\gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
