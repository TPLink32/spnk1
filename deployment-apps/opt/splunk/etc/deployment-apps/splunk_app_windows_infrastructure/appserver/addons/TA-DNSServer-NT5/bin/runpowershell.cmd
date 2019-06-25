@ECHO OFF

:: ######################################################
:: #
:: # Splunk for Microsoft Active Directory
:: # 
:: # Copyright (C) 2011 Splunk, Inc.
:: # All Rights Reserved
:: #
:: ######################################################

set SplunkApp=TA-DNSServer-NT5

%SystemRoot%\system32\WindowsPowerShell\v1.0\powershell.exe -executionPolicy RemoteSigned -command ". '%SPLUNK_HOME%\etc\apps\%SplunkApp%\bin\powershell\%1'"
